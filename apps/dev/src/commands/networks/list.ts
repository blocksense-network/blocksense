import { join } from 'node:path';

import { Command, Options } from '@effect/cli';
import { Effect } from 'effect';

import { valuesOf } from '@blocksense/base-utils/array-iter';
import type { NetworkName } from '@blocksense/base-utils/evm';
import { isTestnet,networkMetadata } from '@blocksense/base-utils/evm';
import { drawTable,renderTui } from '@blocksense/base-utils/tty';
import { configDirs,listEvmNetworks } from '@blocksense/config-types';

export const list = Command.make(
  'list',
  {
    displayMode: Options.choice('display-mode', [
      'table',
      'markdown-list',
    ] as const).pipe(Options.withDefault('table')),
    showConfig: Options.boolean('show-config').pipe(Options.withDefault(false)),
    networkType: Options.choice('network-type', [
      'all',
      'testnet',
      'mainnet',
    ] as const).pipe(Options.withDefault('all')),
    count: Options.boolean('count').pipe(Options.withDefault(false)),
  },
  ({ count, displayMode, networkType, showConfig }) =>
    Effect.gen(function* () {
      const networks = networkTypeFilter(
        yield* Effect.tryPromise(() => listEvmNetworks()),
        networkType,
      ).sort();

      if (networks.length === 0) {
        console.log('No deployed networks found.');
        return;
      }

      if (count) {
        const scopeMsg = networkType === 'all' ? '' : ` (${networkType})`;
        console.log(`Total deployed networks${scopeMsg}: ${networks.length}`);
        return;
      }

      const rows = networks.map(network => {
        const meta = networkMetadata[network];
        const explorerBase = meta.explorers?.[0]?.webUrl ?? '';
        const row: NetworkInfo = {
          network,
          chainId: meta.chainId,
          type: isTestnet(network) ? 'testnet' : 'mainnet',
          explorer: explorerBase,
          deploymentPath: join(
            configDirs.evm_contracts_deployment_v2,
            `${network}.json`,
          ),
        };
        return row;
      });

      if (displayMode === 'markdown-list') {
        printMarkdownList(rows, showConfig);
        return;
      }

      renderTable(rows, showConfig);
    }),
);

type NetworkType = 'all' | 'testnet' | 'mainnet';

interface NetworkInfo {
  network: NetworkName;
  chainId: number;
  explorer: string;
  deploymentPath: string;
  type: 'testnet' | 'mainnet';
}

function networkTypeFilter(
  networks: NetworkName[],
  networkType: NetworkType,
): NetworkName[] {
  if (networkType === 'all') return networks;
  return networks.filter(n =>
    networkType === 'testnet' ? isTestnet(n) : !isTestnet(n),
  );
}

function printMarkdownList(rows: NetworkInfo[], showConfig: boolean): void {
  for (const r of rows) {
    const explorerLink = r.explorer ? `[${r.explorer}](${r.explorer})` : 'N/A';
    console.log(`### ${r.network}`);
    console.log(`- chainId: ${r.chainId}`);
    console.log(`- type: ${r.type}`);
    console.log(`- explorer: ${explorerLink}`);
    if (showConfig) {
      console.log(`- deployment config: ${r.deploymentPath}`);
    }
  }
}

function renderTable(rows: NetworkInfo[], showConfig: boolean): void {
  const headers = ['Network', 'Type', 'Chain ID', 'Explorer'];

  const tableRows = rows.map(r => {
    const { deploymentPath: _, ...tableRows } = r;
    return valuesOf(tableRows).map(v => v.toString());
  });
  renderTui(drawTable(tableRows, { headers }));

  if (showConfig) {
    console.log('\nDeployment Configs:');
    for (const r of rows) {
      console.log(`- ${r.network}: ${r.deploymentPath}`);
    }
  }
}
