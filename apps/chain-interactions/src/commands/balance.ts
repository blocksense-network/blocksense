import { Effect, Option, Schema as S } from 'effect';
import { Command, Options } from '@effect/cli';
import { withAlias, withDefault, withSchema } from '@effect/cli/Options';
import client from 'prom-client';
import Web3 from 'web3';

import { getEnvStringNotAssert } from '@blocksense/base-utils/env';
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
        const balanceWei = yield* Effect.tryPromise({
          try: () => web3.eth.getBalance(address),
          catch: e =>
            console.error(
              c`{red Failed to fetch balance from (RPC: ${rpcUrl})}`,
              (e as Error).message,
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (balanceWei != 0n && !balanceWei) {
          continue;
        }

        const balance = web3.utils.fromWei(balanceWei, 'ether');
        const meta = (
          networkMetadata as Record<string, { currency?: string } | undefined>
        )[networkName];
        const currency = meta?.currency ?? 'ETH';

        console.log(
          balanceWei === 0n
            ? c`{grey ${networkName}: ${balance} ${currency}}`
            : c`{green ${networkName}: ${balance} ${currency}}`,
        );
        if (balanceGauge) {
          balanceGauge.set(
            { networkName, address, rpcUrl: String(rpcUrl) },
            filterSmallBalance(balance),
          );
        }
      }
    }),
);
