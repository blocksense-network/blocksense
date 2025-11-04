import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withDefault, withSchema } from '@effect/cli/Options';
import client from 'prom-client';
import Web3 from 'web3';

import type {
  ChainId,
  EthereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';
import {
  getNetworkNameByChainId,
  getOptionalRpcUrl,
  isChainId,
  isTestnet,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';

import { deployedMainnets, deployedTestnets } from './types';
import { getDefaultSequencerAddress, startPrometheusServer } from './utils';

export const checkPending = Command.make(
  'check-pending',
  {
    addressInput: Options.optional(
      Options.text('address').pipe(withAlias('a')),
    ),
    network: Options.optional(Options.text('network')).pipe(withAlias('n')),
    rpcUrlInput: Options.optional(
      Options.text('rpc-url').pipe(withSchema(S.URL), withAlias('r')),
    ),
    prometheus: Options.boolean('prometheus').pipe(withAlias('p')),
    host: Options.text('host').pipe(withDefault('localhost'), withAlias('h')),
    port: Options.integer('port').pipe(withDefault(9090)),
    mainnet: Options.boolean('mainnet').pipe(withAlias('m')),
  },
  ({ addressInput, host, mainnet, network, port, prometheus, rpcUrlInput }) =>
    Effect.gen(function* () {
      const parsedNetwork = Option.isSome(network)
        ? parseNetworkName(network.value)
        : null;
      const shouldUseMainnetSequencer =
        mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

      const sequencerAddress = getDefaultSequencerAddress(
        shouldUseMainnetSequencer,
      );

      let address: EthereumAddress;
      if (Option.isSome(addressInput)) {
        address = parseEthereumAddress(addressInput.value);
      } else {
        address = sequencerAddress;
      }

      let pendingGauge: client.Gauge | null = null;

      if (prometheus) {
        startPrometheusServer(host, port);
        pendingGauge = new client.Gauge({
          name: 'eth_account_pending',
          help: 'How many pending transactions this account has',
          labelNames: ['networkName', 'address'],
        });
      }

      let networks;
      if (mainnet) {
        networks = deployedMainnets;
      } else if (Option.isSome(network)) {
        networks = [parseNetworkName(network.value)];
      }
      if (Option.isSome(rpcUrlInput)) {
        const web3 = new Web3(String(rpcUrlInput.value));
        const chainId = yield* Effect.tryPromise({
          try: () => web3.eth.net.getId(),
          catch: e =>
            console.error(
              c`{red Failed to fetch chain ID from (RPC: ${rpcUrlInput.value})}`,
              (e as Error).message,
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (isChainId(Number(chainId))) {
          const chainIdNum = Number(chainId) as ChainId;
          const networkName = getNetworkNameByChainId(chainIdNum);
          networks = [networkName];
        } else {
          networks = ['unknown'];
          console.log(
            c`{red Could not determine network name from chain ID ${chainId}.}`,
          );
        }
      }
      if (!networks) {
        networks = deployedTestnets;
      }

      for (const networkName of networks) {
        const rpcUrl = Option.isSome(rpcUrlInput)
          ? rpcUrlInput.value
          : networkName === 'unknown'
            ? ''
            : getOptionalRpcUrl(networkName as NetworkName);
        if (rpcUrl === '') {
          console.log(`No rpc url for network ${networkName}. Skipping.`);
          continue;
        }
        const web3 = new Web3(String(rpcUrl));
        const latestNonce = yield* Effect.tryPromise({
          try: () => web3.eth.getTransactionCount(address, 'latest'),
          catch: e =>
            console.error(
              c`{red Failed to get latest nonce for network ${networkName} (RPC: ${String(rpcUrl)})}`,
              (e as Error).message,
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));

        const pendingNonce = yield* Effect.tryPromise({
          try: () => web3.eth.getTransactionCount(address, 'pending'),
          catch: e =>
            console.error(
              c`{red Failed to get pending nonce for network ${networkName} (RPC: ${String(rpcUrl)})}`,
              (e as Error).message,
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (
          (latestNonce != 0n && !latestNonce) ||
          (pendingNonce != 0n && !pendingNonce)
        ) {
          continue;
        }

        const nonceDifference = Number(pendingNonce - latestNonce);

        if (nonceDifference) {
          console.log(c`{red Nonce difference found on ${networkName}:}`);
          console.log(
            c`{red   Latest: ${latestNonce}, Pending: ${pendingNonce}}`,
          );
        } else {
          console.log(c`{green No Nonce difference found on ${networkName}:}`);
          console.log(
            c`{green   Latest: ${latestNonce}, Pending: ${pendingNonce}}`,
          );
        }
        if (pendingGauge) {
          pendingGauge.set({ networkName, address }, nonceDifference);
        }
      }
    }),
);
