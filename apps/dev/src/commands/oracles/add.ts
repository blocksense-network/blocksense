import { Command, Options } from '@effect/cli';
import { Effect, Option } from 'effect';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import ejs from 'ejs';
import { parse as parseToml } from 'toml';

import { rootDir } from '@blocksense/base-utils/env';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';

const ORACLES_DIR = join(rootDir, 'apps', 'oracles');
const DEV_TEMPLATES_DIR = join(
  rootDir,
  'apps',
  'dev',
  'src',
  'commands',
  'oracles',
  'templates',
);

export const isValidWorkspace = (name: string) =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

type TemplateContext = {
  workspaceName: string;
  oracleName: string;
  description: string;
  wasmFileName: string;
  componentName: string;
};

async function renderTemplate(
  templateRelPath: string,
  context: TemplateContext,
): Promise<string> {
  const tpl = await readFile(join(DEV_TEMPLATES_DIR, templateRelPath), 'utf8');
  return ejs.render(tpl, context, { rmWhitespace: false });
}

async function addToCargoMembers(workspaceName: string): Promise<void> {
  const filePath = join(ORACLES_DIR, 'Cargo.toml');
  const original = await readFile(filePath, 'utf8');
  const parsed = parseToml(original) as any;

  if (!parsed.workspace) parsed.workspace = {};
  if (!Array.isArray(parsed.workspace.members)) parsed.workspace.members = [];
  const members: Array<string> = parsed.workspace.members;
  if (!members.includes(workspaceName)) members.push(workspaceName);

  const wsStart = original.indexOf('[workspace]');
  if (wsStart === -1) return;
  const restFromWs = original.slice(wsStart);
  const wsEndRel = restFromWs.indexOf('\n]');
  const wsEndAbs = wsEndRel === -1 ? original.length : wsStart + wsEndRel + 2;

  const normalizedBlock = [
    '[workspace]',
    'members = [',
    ...members.map(m => `  "${m}",`),
    ']',
  ].join('\n');

  const updated =
    original.slice(0, wsStart) + normalizedBlock + original.slice(wsEndAbs);
  await writeFile(filePath, updated, 'utf8');
}

async function addToNixOracleScripts(workspaceName: string): Promise<void> {
  const filePath = join(rootDir, 'nix', 'pkgs', 'default.nix');
  const original = await readFile(filePath, 'utf8');
  if (
    original.includes(`${workspaceName} = mkOracleScript "${workspaceName}";`)
  )
    return;
  const m = original.match(/(oracle-scripts\s*=\s*\{)/m);
  if (!m || m.index === undefined) return;
  const startIdx = m.index + m[0].length;

  let depth = 1;
  let i = startIdx;
  let endIdx = -1;
  while (i < original.length) {
    const ch = original[i++];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) return;

  const afterBlock = original.slice(startIdx);
  const firstLine = afterBlock.split('\n')[0] ?? '';
  const indentMatch = firstLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '  ';

  const insertion = `\n${indent}${workspaceName} = mkOracleScript "${workspaceName}";`;
  const updated =
    original.slice(0, endIdx - 1) + insertion + original.slice(endIdx - 1);
  await writeFile(filePath, updated, 'utf8');
}

async function addToNixTestEnv(workspaceName: string): Promise<void> {
  const filePath = join(
    rootDir,
    'nix',
    'test-environments',
    'example-setup-01.nix',
  );
  const original = await readFile(filePath, 'utf8');
  const already = new RegExp(`\\n\\s*${workspaceName}\\s*=\\s*\\{`, 'm').test(
    original,
  );
  if (already) return;
  const m = original.match(/(services\.blocksense\.oracles\s*=\s*\{)/m);
  if (!m || m.index === undefined) return;
  const startIdx = m.index + m[0].length;

  let depth = 1;
  let i = startIdx;
  let endIdx = -1;
  while (i < original.length) {
    const ch = original[i++];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) return;

  const afterBlock = original.slice(startIdx, endIdx);
  const entryLine =
    afterBlock.split('\n').find((l: string) => /\S/.test(l)) ?? '      ';
  const indentMatch = entryLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '      ';

  const block = `\n${indent}${workspaceName} = {\n${indent}  exec-interval = 10;\n${indent}  allowed-outbound-hosts = [ ];\n${indent}};`;
  const updated =
    original.slice(0, endIdx - 1) + block + original.slice(endIdx - 1);
  await writeFile(filePath, updated, 'utf8');
}

async function ensureTemplates(): Promise<void> {
  const needed = ['Cargo.toml.ejs', 'spin.toml.ejs', 'src/lib.rs.ejs'];
  for (const f of needed) {
    const p = join(DEV_TEMPLATES_DIR, f);
    if (!(await pathExists(p))) {
      throw new Error(`Missing template: ${p}`);
    }
  }
}

async function promptIfMissing(
  ws: string,
  oname: string,
  desc: string,
): Promise<[string, string, string]> {
  if (ws && oname && desc) return [ws, oname, desc];
  const { createInterface } = await import('readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!ws)
      ws = (await rl.question('Oracle workspace name (kebab-case): ')).trim();
    if (!oname)
      oname = (await rl.question('Oracle name (human-readable): ')).trim();
    if (!desc) desc = (await rl.question('Description: ')).trim();
  } finally {
    rl.close();
  }
  return [ws, oname, desc];
}

export const add = Command.make(
  'add',
  {
    workspaceName: Options.optional(Options.text('workspace-name')),
    oracleName: Options.optional(Options.text('oracle-name')),
    description: Options.optional(Options.text('description')),
    noNix: Options.boolean('no-nix').pipe(Options.withDefault(false)),
  },
  ({ description, noNix, oracleName, workspaceName }) =>
    Effect.gen(function* () {
      let ws = Option.getOrElse(workspaceName, () => '').trim();
      let oname = Option.getOrElse(oracleName, () => '').trim();
      let desc = Option.getOrElse(description, () => '').trim();

      [ws, oname, desc] = (yield* Effect.tryPromise(() =>
        promptIfMissing(ws, oname, desc),
      )) as [string, string, string];

      if (!isValidWorkspace(ws)) {
        return yield* Effect.fail(
          new Error(
            'Invalid workspace name. Use kebab-case: ^[a-z0-9]+(-[a-z0-9]+)*$',
          ),
        );
      }

      const targetDir = join(ORACLES_DIR, ws);
      const targetExists = (yield* Effect.tryPromise(() =>
        pathExists(targetDir),
      )) as boolean;
      if (targetExists) {
        return yield* Effect.fail(
          new Error(`Workspace directory already exists: ${targetDir}`),
        );
      }

      const cargoTomlText = (yield* Effect.tryPromise(() =>
        readFile(join(ORACLES_DIR, 'Cargo.toml'), 'utf8'),
      )) as string;
      if (cargoTomlText.includes(`"${ws}"`)) {
        return yield* Effect.fail(
          new Error(
            `Workspace member '${ws}' already listed in apps/oracles/Cargo.toml`,
          ),
        );
      }

      const wasmFileName = ws.replace(/-/g, '_');
      const componentName = ws;
      const ctx = {
        workspaceName: ws,
        oracleName: oname,
        description: desc,
        wasmFileName,
        componentName,
      } as const;

      yield* Effect.tryPromise(() => ensureTemplates());
      yield* Effect.tryPromise(() =>
        mkdir(join(targetDir, 'src'), { recursive: true }),
      );

      const writeFilesEffect = Effect.gen(function* () {
        const cargoToml = (yield* Effect.tryPromise(() =>
          renderTemplate('Cargo.toml.ejs', ctx),
        )) as string;
        const spinToml = (yield* Effect.tryPromise(() =>
          renderTemplate('spin.toml.ejs', ctx),
        )) as string;
        const libRs = (yield* Effect.tryPromise(() =>
          renderTemplate('src/lib.rs.ejs', ctx),
        )) as string;
        yield* Effect.tryPromise(() =>
          writeFile(join(targetDir, 'Cargo.toml'), cargoToml, 'utf8'),
        );
        yield* Effect.tryPromise(() =>
          writeFile(join(targetDir, 'spin.toml'), spinToml, 'utf8'),
        );
        yield* Effect.tryPromise(() =>
          writeFile(join(targetDir, 'src', 'lib.rs'), libRs, 'utf8'),
        );
      });

      yield* Effect.catchAll(writeFilesEffect, e =>
        Effect.zipRight(
          Effect.tryPromise(() =>
            rm(targetDir, { recursive: true, force: true }),
          ),
          Effect.fail(e as Error),
        ),
      );

      yield* Effect.tryPromise(() => addToCargoMembers(ws));
      if (!noNix) {
        yield* Effect.tryPromise(() => addToNixOracleScripts(ws));
        yield* Effect.tryPromise(() => addToNixTestEnv(ws));
      }

      renderTui(
        drawTable(
          [
            ['workspace', ws],
            ['oracle name', oname],
            ['directory', targetDir],
            ['cargo member', 'added'],
            ['nix wiring', noNix ? 'skipped' : 'added'],
          ],
          { headers: ['Item', 'Value'] },
        ),
      );
    }),
);
