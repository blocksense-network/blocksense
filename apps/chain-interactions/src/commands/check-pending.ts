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
  parseEthereumAddress,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import {
  getDefaultSequencerAddress,
  getNetworks,
  getNonce,
  getWeb3,
  startPrometheusServer,
} from './utils';

export const checkPending = Command.make(
  'check-pending',
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
      withDescription(
        'Show if there are pending transactions for deployedMainnets',
      ),
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

      let pendingGauge: client.Gauge | null = null;

      if (prometheus) {
        yield* startPrometheusServer(host, port);
        pendingGauge = new client.Gauge({
          name: 'eth_account_pending',
          help: 'How many pending transactions this account has',
          labelNames: ['networkName', 'address'],
        });
      }

      const networks = yield* getNetworks(network, rpcUrlInput, mainnet);

      yield* Effect.forEach(
        networks as Array<'unknown' | NetworkName>,
        networkName =>
          Effect.gen(function* () {
            const rpcUrl = Option.getOrElse(rpcUrlInput, () =>
              getOptionalRpcUrl(networkName as NetworkName),
            );

            const web3 = yield* getWeb3(rpcUrl);

            const latestNonce = yield* getNonce(address, web3, 'latest');
            const pendingNonce = yield* getNonce(address, web3, 'pending');

            const nonceDifference = Number(pendingNonce - latestNonce);

            console.log(
              c`{${nonceDifference ? 'red' : 'green No'} Nonce difference found on ${networkName}:} \n  {${nonceDifference ? 'red' : 'green'}   Latest: ${latestNonce}, Pending: ${pendingNonce}}`,
            );

            if (pendingGauge) {
              pendingGauge.set({ networkName, address }, nonceDifference);
            }
          }).pipe(Effect.catchAll(() => Effect.sync(() => {}))),
      );
    }),
);
