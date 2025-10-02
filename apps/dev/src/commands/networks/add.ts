import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import * as NodeContext from '@effect/platform-node/NodeContext';

import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import { rootDir } from '@blocksense/base-utils/env';

// Path to the canonical networks source file to mutate.
const NETWORKS_TS = join(rootDir, 'libs/ts/base-utils/src/evm/networks.ts');

// Simple matcher helpers for insertion points.
const NETWORKS_ARRAY_REGEX =
  /(const\s+networks\s*=\s*\[)([\s\S]*?)(\]\s*as const;)/m;
const CHAINIDS_ARRAY_REGEX =
  /(const\s+chainIds\s*=\s*\[)([\s\S]*?)(\]\s*as const;)/m;
const METADATA_OBJ_REGEX =
  /(export const networkMetadata = \{)([\s\S]*?)(^\};)/m;

interface RpcValidationResult {
  ok: boolean;
  chainId?: number;
  error?: string;
}

async function validateRpc(
  rpc: string,
  timeout: number,
): Promise<RpcValidationResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json: any = await res.json();
    const hex = json?.result;
    if (!hex || !/^0x[0-9a-fA-F]+$/.test(hex))
      return { ok: false, error: 'Invalid eth_chainId response' };
    return { ok: true, chainId: parseInt(hex, 16) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(t);
  }
}

export const add = Command.make(
  'add',
  {
    name: Options.text('name'),
    chainId: Options.optional(Options.integer('chain-id')),
    type: Options.choice('type', ['mainnet', 'testnet'] as const),
    rpc: Options.text('rpc'),
    explorer: Options.optional(Options.text('explorer')),
    currency: Options.optional(Options.text('currency')),
    decimals: Options.optional(Options.integer('decimals')),
    tags: Options.optional(Options.text('tags')),
    displayName: Options.optional(Options.text('display-name')),
    validate: Options.boolean('validate').pipe(Options.withDefault(false)),
    timeout: Options.integer('timeout').pipe(Options.withDefault(3000)),
    update: Options.boolean('update').pipe(Options.withDefault(false)),
    dryRun: Options.boolean('dry-run').pipe(Options.withDefault(false)),
    json: Options.boolean('json').pipe(Options.withDefault(false)),
    quiet: Options.boolean('quiet').pipe(Options.withDefault(false)),
  },
  args =>
    Effect.gen(function* () {
      const name = args.name.trim();
      const chainIdFlag = Option.getOrUndefined(args.chainId);
      const rpc = args.rpc.trim();

      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        return yield* Effect.fail(
          Object.assign(new Error('Invalid network slug. Use kebab-case.'), {
            code: 2,
          }),
        );
      }

      let finalChainId = chainIdFlag;
      if (args.validate) {
        const v = yield* Effect.tryPromise(() =>
          validateRpc(rpc, args.timeout),
        );
        if (!v.ok) {
          return yield* Effect.fail(
            Object.assign(new Error(`RPC validation failed: ${v.error}`), {
              code: 3,
            }),
          );
        }
        if (finalChainId && v.chainId && finalChainId !== v.chainId) {
          return yield* Effect.fail(
            Object.assign(
              new Error(
                `RPC chainId mismatch. expected=${finalChainId} got=${v.chainId}`,
              ),
              { code: 3 },
            ),
          );
        }
        finalChainId ||= v.chainId;
      }

      if (finalChainId == null) {
        return yield* Effect.fail(
          Object.assign(
            new Error('Missing --chain-id (or use --validate to infer).'),
            { code: 2 },
          ),
        );
      }

      // Load file
      const original = (yield* Effect.tryPromise(() =>
        readFile(NETWORKS_TS, 'utf8'),
      )) as string;

      // Determine presence
      const already = new RegExp(`['\"]${name}['\"]`).test(original);
      if (already && !args.update) {
        return yield* Effect.fail(
          Object.assign(
            new Error(
              `Network '${name}' already exists. Pass --update to modify.`,
            ),
            { code: 2 },
          ),
        );
      }

      // Insert/update networks array
      const netsMatch = original.match(NETWORKS_ARRAY_REGEX);
      if (!netsMatch) {
        return yield* Effect.fail(
          new Error('Could not locate networks array.'),
        );
      }
      let networksBlock = netsMatch[2];
      if (!already) {
        // Insert keeping simple sorted order
        const entries = networksBlock
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0);
        const list = entries
          .map(l => l.replace(/[,']/g, '').replace(/"/g, '').trim())
          .filter(l => l.length > 0);
        list.push(name);
        const sorted = [...new Set(list)].sort();
        networksBlock = '\n  ' + sorted.map(n => `'${n}',`).join('\n  ') + '\n';
      }

      // Chain IDs array
      const idsMatch = original.match(CHAINIDS_ARRAY_REGEX);
      if (!idsMatch) {
        return yield* Effect.fail(
          new Error('Could not locate chainIds array.'),
        );
      }
      let chainIdsBlock = idsMatch[2];
      if (!new RegExp(`(^|\n)\s*${finalChainId}\s*,`).test(chainIdsBlock)) {
        // Append and keep formatting
        const nums = chainIdsBlock
          .split(/[,\n]/)
          .map(v => v.trim())
          .filter(v => v.length > 0)
          .map(v => Number(v));
        if (!nums.includes(finalChainId)) nums.push(finalChainId);
        chainIdsBlock = '\n  ' + nums.sort((a, b) => a - b).join(', ') + ',\n';
      }

      // Metadata object update or insertion
      const metaMatch = original.match(METADATA_OBJ_REGEX);
      if (!metaMatch) {
        return yield* Effect.fail(
          new Error('Could not locate networkMetadata object.'),
        );
      }
      let metadataBody = metaMatch[2];

      const explorerUrl = Option.getOrUndefined(args.explorer) ?? '';
      const currencySym =
        Option.getOrUndefined(args.currency) || 'Currency.ETH';
      let newEntry = `  '${name}': {\n    chainId: ${finalChainId},\n    isTestnet: ${args.type === 'testnet'},\n    explorers: [\n      { type: 'unknown', webUrl: '${explorerUrl}', apiUrl: null },\n    ],\n    currency: ${currencySym},\n  },\n`;

      // Ensure Currency import already exists; if not, user must manually adjust.
      if (!/enum Currency/.test(original) && !/Currency\./.test(original)) {
        // Best-effort: leave as raw symbol
        newEntry = newEntry.replace(
          /currency: .*?,/,
          'currency: Currency.ETH,',
        );
      }

      if (already) {
        // Replace existing block for that network (naive regex)
        const pattern = new RegExp(`\n\s*'${name}': \{[\s\S]*?\n\s*\},?\n`);
        if (pattern.test(metadataBody)) {
          metadataBody = metadataBody.replace(pattern, '\n' + newEntry);
        } else {
          // Fallback append
          metadataBody = metadataBody + newEntry;
        }
      } else {
        metadataBody = metadataBody + newEntry;
      }

      const updated = original
        // networks array
        .replace(NETWORKS_ARRAY_REGEX, `$1${networksBlock}$3`)
        // chainIds
        .replace(CHAINIDS_ARRAY_REGEX, `$1${chainIdsBlock}$3`)
        // metadata
        .replace(METADATA_OBJ_REGEX, `$1${metadataBody}$3`);

      if (args.dryRun) {
        if (!args.quiet) {
          renderTui(
            drawTable(
              [
                ['action', already ? 'update' : 'add'],
                ['name', name],
                ['chainId', String(finalChainId)],
                ['type', args.type],
                ['rpc', rpc],
                ['explorer', explorerUrl],
                ['dryRun', 'true'],
              ],
              { headers: ['Field', 'Value'] },
            ),
          );
        }
        return;
      }

      // Atomic-ish write: write temp then overwrite.
      const tmp = NETWORKS_TS + '.' + randomBytes(4).toString('hex') + '.tmp';
      yield* Effect.tryPromise(() => writeFile(tmp, updated, 'utf8'));
      yield* Effect.tryPromise(() => writeFile(NETWORKS_TS, updated, 'utf8'));

      if (args.json) {
        console.log(
          JSON.stringify(
            {
              name,
              chainId: finalChainId,
              type: args.type,
              rpc,
              explorer: explorerUrl,
              updated: already,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (!args.quiet) {
        renderTui(
          drawTable(
            [
              ['result', already ? 'updated' : 'added'],
              ['name', name],
              ['chainId', String(finalChainId)],
              ['type', args.type],
              ['rpc', rpc],
              ['explorer', explorerUrl],
            ],
            { headers: ['Field', 'Value'] },
          ),
        );
      }
    }).pipe(Effect.provide(NodeContext.layer)),
);
