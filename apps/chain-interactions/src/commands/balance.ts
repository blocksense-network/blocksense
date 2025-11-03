import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withDefault, withSchema } from '@effect/cli/Options';
import client from 'prom-client';
import Web3 from 'web3';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
import type { EthereumAddress } from '@blocksense/base-utils/evm';
import {
  getNetworkNameByChainId,
  getOptionalRpcUrl,
  isChainId,
  isTestnet,
  networkMetadata,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';
import { listEvmNetworks } from '@blocksense/config-types/read-write-config';

import { deployedMainnets, deployedTestnets } from './types';
import { filterSmallBalance, startPrometheusServer } from './utils';

export const balance = Command.make(
  'balance',
  {
    addressInput: Options.optional(
      Options.text('address').pipe(withAlias('a')),
    ),
    network: Options.optional(
      Options.choice('network', await listEvmNetworks()).pipe(withAlias('n')),
    ),
    rpcUrl: Options.optional(
      Options.text('rpc-url').pipe(withSchema(S.URL), withAlias('r')),
    ),
    prometheus: Options.boolean('prometheus').pipe(withAlias('p')),
    host: Options.text('host').pipe(withDefault('localhost'), withAlias('h')),
    port: Options.integer('port').pipe(withDefault(9090)),
    mainnet: Options.boolean('mainnet').pipe(withAlias('m')),
  },
  ({ addressInput, host, mainnet, network, port, prometheus, rpcUrl }) =>
    Effect.gen(function* () {
      const parsedNetwork = Option.isSome(network)
        ? parseNetworkName(network.value)
        : null;
      const shouldUseMainnetSequencer =
        mainnet || (parsedNetwork !== null && !isTestnet(parsedNetwork));

      const sequencerAddress = yield* Effect.try({
        try: () =>
          parseEthereumAddress(
            getEnvStringNotAssert(
              shouldUseMainnetSequencer
                ? 'SEQUENCER_ADDRESS_MAINNET'
                : 'SEQUENCER_ADDRESS_TESTNET',
            ),
          ),
        catch: e =>
          new Error(
            `Invalid Ethereum address ${address}: ${(e as Error)?.message}`,
          ),
      });

      let address: EthereumAddress;
      if (Option.isSome(addressInput)) {
        address = parseEthereumAddress(addressInput.value);
      } else {
        address = sequencerAddress;
      }

      let balanceGauge: client.Gauge | null = null;

      if (prometheus) {
        startPrometheusServer(host, port);
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

      if (Option.isSome(rpcUrl)) {
        console.log(c`{yellow Using custom RPC URL: ${rpcUrl.value}}\n`);

        const web3 = new Web3(String(rpcUrl.value));

        const balanceWei = yield* Effect.tryPromise({
          try: () => web3.eth.getBalance(address),
          catch: e =>
            console.error(
              c`{red Failed to fetch balance from (RPC: ${rpcUrl.value})}`,
              (e as Error).message,
            ),
        });
        const balance = web3.utils.fromWei(balanceWei, 'ether');
        const chainId = yield* Effect.tryPromise({
          try: () => web3.eth.net.getId(),
          catch: e =>
            console.error(
              c`{red Failed to fetch chain ID from (RPC: ${rpcUrl})}`,
              (e as Error).message,
            ),
        });
        const networkName = isChainId(Number(chainId))
          ? getNetworkNameByChainId(Number(chainId))
          : 'unknown';
        const message = `${balance} (RPC: ${rpcUrl.value}) (NetworkName: ${networkName})`;

        console.log(
          networkName === 'unknown'
            ? c`{red ${message}}`
            : c`{green ${message}}`,
        );
        if (balanceGauge) {
          balanceGauge.set(
            { networkName, address, rpcUrl: String(rpcUrl.value) },
            filterSmallBalance(balance),
          );
        }
        return;
      }

      const networks = Option.isSome(network)
        ? [parseNetworkName(network.value)]
        : mainnet
          ? deployedMainnets
          : deployedTestnets;
      for (const networkName of networks) {
        const rpcUrl = getOptionalRpcUrl(networkName);
        if (rpcUrl === '') {
          console.log(`No rpc url for network ${networkName}. Skipping.`);
          continue;
        }
        const web3 = new Web3(rpcUrl);

        const balanceWei = yield* Effect.tryPromise({
          try: () => web3.eth.getBalance(address),
          catch: e =>
            console.error(
              c`{red Failed to fetch balance from (RPC: ${rpcUrl})}`,
              (e as Error).message,
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (!balanceWei) {
          continue;
        }
        const balance = web3.utils.fromWei(balanceWei, 'ether');
        const { currency } = networkMetadata[networkName];

        console.log(
          balanceWei === 0n
            ? c`{grey ${networkName}: ${balance} ${currency}}`
            : c`{green ${networkName}: ${balance} ${currency}}`,
        );
        if (balanceGauge) {
          balanceGauge.set(
            { networkName, address, rpcUrl },
            filterSmallBalance(balance),
          );
        }
      }
    }),
);
