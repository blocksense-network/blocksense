import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import {
  withAlias,
  withDefault,
  withDescription,
  withSchema,
} from '@effect/cli/Options';
import client from 'prom-client';

import type { NetworkName } from '@blocksense/base-utils/evm';
import {
  getOptionalRpcUrl,
  isTestnet,
  networkMetadata,
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import {
  filterSmallBalance,
  getBalance,
  getDefaultSequencerAddress,
  getNetworks,
  getWeb3,
  startPrometheusServer,
} from './utils';

export const balance = Command.make(
  'balance',
  {
    addressInput: Options.optional(
      Options.text('address').pipe(withAlias('a')),
    ),
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()).pipe(withAlias('n')),
    ),
    rpcUrlInput: Options.optional(
      Options.text('rpc').pipe(withSchema(S.URL), withAlias('r')),
    ),
    prometheus: Options.boolean('prometheus').pipe(withAlias('p')),
    host: Options.text('host').pipe(withDefault('localhost')),
    port: Options.integer('port').pipe(withDefault(9090)),
    mainnet: Options.boolean('mainnet').pipe(
      withAlias('m'),
      withDescription('Show balance for deployedMainnets'),
    ),
  },
  ({ addressInput, host, mainnet, network, port, prometheus, rpcUrlInput }) =>
    Effect.gen(function* () {
      const parsedNetwork = Option.getOrNull(network);
      const shouldUseMainnetSequencer =
        mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

      const sequencerAddress = yield* getDefaultSequencerAddress(
        shouldUseMainnetSequencer,
      );

      const address = parseEthereumAddress(
        Option.getOrElse(addressInput, () => sequencerAddress),
      );
      let balanceGauge: client.Gauge | null = null;

      if (prometheus) {
        yield* startPrometheusServer(host, port);
        balanceGauge = new client.Gauge({
          name: 'eth_account_balance',
          help: 'Ethereum account balance in native token',
          labelNames: ['networkName', 'address', 'rpcUrl'],
        });
      }

      console.log(
        c`{cyan Using Ethereum address: ${address} (sequencer: ${
          address === sequencerAddress
        })}\n`,
      );

      const networks = yield* getNetworks(network, rpcUrlInput, mainnet);

      yield* Effect.forEach(
        networks as Array<'unknown' | NetworkName>,
        networkName =>
          Effect.gen(function* () {
            const rpcUrl = Option.getOrElse(rpcUrlInput, () =>
              getOptionalRpcUrl(networkName as NetworkName),
            );

            const web3 = yield* getWeb3(rpcUrl);

            const balance = yield* getBalance(address, web3);

            const meta = (
              networkMetadata as Record<
                string,
                { currency?: string } | undefined
              >
            )[networkName];
            const currency = meta?.currency ?? 'ETH';

            console.log(
              balance === '0'
                ? c`{grey ${networkName}: ${balance} ${currency}}`
                : c`{green ${networkName}: ${balance} ${currency}}`,
            );
            if (balanceGauge) {
              balanceGauge.set(
                { networkName, address, rpcUrl: String(rpcUrl) },
                yield* filterSmallBalance(balance),
              );
            }
          }).pipe(Effect.catchAll(() => Effect.sync(() => {}))),
      );
    }),
);
