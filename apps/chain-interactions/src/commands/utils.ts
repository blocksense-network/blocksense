import { Effect, Option } from 'effect';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import express from 'express';
import client from 'prom-client';
import type { Web3Account } from 'web3';
import Web3 from 'web3';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import type {
  ChainId,
  EthereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';
import {
  getNetworkNameByChainId,
  getOptionalRpcUrl,
  isChainId,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';

import { deployedMainnets, deployedTestnets } from './types';

export const startPrometheusServer = (
  host: string,
  port: number,
): Effect.Effect<void, never, never> =>
  Effect.async<void, never>(resume => {
    const app = express();
    app.get('/metrics', async (_req, res) => {
      res.set('Content-Type', client.register.contentType);
      res.end(await client.register.metrics());
    });

    const listen = (currentPort: number, retried: boolean): void => {
      const server = app.listen(currentPort, host);

      const onListening = (): void => {
        const address = server.address();
        const resolvedPort =
          typeof address === 'object' && address !== null
            ? address.port
            : currentPort;

        server.off('error', onError);
        console.log(
          c`{blue Prometheus metrics exposed at http://${host}:${resolvedPort}/metrics}`,
        );
        resume(Effect.succeed(undefined));
      };

      const onError = (error: NodeJS.ErrnoException): void => {
        server.off('listening', onListening);

        if (error.code === 'EADDRINUSE' && !retried) {
          server.close(() => listen(0, true));
          return;
        }

        console.error(
          c`{red Failed to start Prometheus metrics server: ${error.message}}`,
        );
        resume(Effect.succeed(undefined));
      };

      server.once('listening', onListening);
      server.once('error', onError);
    };

    listen(port, false);
  });

export function filterSmallBalance(
  balance: string,
  threshold = 1e-6,
): Effect.Effect<number, never, never> {
  return Number(balance) < threshold
    ? Effect.succeed(0)
    : Effect.succeed(Number(balance));
}

export function getDefaultSequencerAddress(
  shouldUseMainnetSequencer: boolean,
): Effect.Effect<EthereumAddress, never, never> {
  if (shouldUseMainnetSequencer) {
    return Effect.succeed(
      parseEthereumAddress(
        getOptionalEnvString(
          'SEQUENCER_ADDRESS_MAINNET',
          '0x1F412F1dBab58E41d37ba31115c811B0fBD10904',
        ),
      ),
    );
  }
  return Effect.succeed(
    parseEthereumAddress(
      getOptionalEnvString(
        'SEQUENCER_ADDRESS_TESTNET',
        '0xd756119012CcabBC59910dE0ecEbE406B5b952bE',
      ),
    ),
  );
}

export const getNetworks = (
  network: Option.Option<string>,
  rpcUrlInput: Option.Option<URL>,
  mainnet: boolean,
): Effect.Effect<Array<'unknown' | NetworkName>, Error, never> =>
  Effect.gen(function* () {
    let networks: Array<'unknown' | NetworkName> = mainnet
      ? deployedMainnets
      : deployedTestnets;

    if (Option.isSome(network)) {
      networks = [parseNetworkName(network.value)];
      return networks;
    }

    if (Option.isNone(rpcUrlInput)) {
      return networks;
    }

    const web3 = yield* getWeb3(rpcUrlInput.value);

    const chainId = yield* getChainId(web3);

    if (isChainId(Number(chainId))) {
      const chainIdNum = Number(chainId) as ChainId;
      const networkName = getNetworkNameByChainId(chainIdNum);
      return [networkName];
    }

    console.log(
      c`{red Could not determine network name from chain ID ${String(chainId)}.}`,
    );
    return ['unknown'];
  });

export const getBalance = (
  address: string,
  rpcOrWeb3: URL | string | Web3,
): Effect.Effect<string, never, never> =>
  Effect.catchAll(
    Effect.gen(function* () {
      const web3 =
        rpcOrWeb3 instanceof Web3 ? rpcOrWeb3 : yield* getWeb3(rpcOrWeb3);
      const balanceWei = yield* Effect.tryPromise(() =>
        web3.eth.getBalance(address),
      );
      return web3.utils.fromWei(balanceWei, 'ether');
    }),
    error =>
      Effect.sync(() => {
        console.error(
          c`{yellow Failed to get balance for address ${address}: \n ${
            (error as Error)?.message ?? String(error)
          }. Returning 0}`,
        );
        return '0';
      }),
  );

export const getNonce = (
  address: EthereumAddress,
  web3: Web3,
  blockNumber: 'latest' | 'pending' = 'latest',
): Effect.Effect<bigint, Error, never> =>
  Effect.tryPromise({
    try: async () => {
      const count = await web3.eth.getTransactionCount(address, blockNumber);
      return count;
    },
    catch: error => {
      return new Error(
        `Failed to get nonce for ${address} (${blockNumber}): ${String(error)}`,
      );
    },
  });

export const getWeb3 = (
  rpcUrl: URL | string,
): Effect.Effect<Web3, Error, never> =>
  Effect.tryPromise({
    try: async () => {
      const web3 = new Web3(String(rpcUrl));
      await web3.eth.getChainId(); // Test connection
      return web3;
    },
    catch: error => {
      return new Error(
        `Failed to initialize Web3 from rpc - ${rpcUrl}: ${String((error as Error)?.message ?? error)}`,
      );
    },
  });

export const getChainId = (web3: Web3): Effect.Effect<bigint, Error, never> =>
  Effect.gen(function* () {
    const chainId = yield* Effect.tryPromise({
      try: async () => web3.eth.getChainId(),
      catch: error => {
        return new Error(`Failed to get chainID: ${String(error)}`);
      },
    });
    return chainId;
  });

export const getCurrentGasPrice = (
  web3: Web3,
): Effect.Effect<bigint, Error, never> =>
  Effect.tryPromise(() =>
    web3.eth
      .getGasPrice()
      .then(gasPrice =>
        typeof gasPrice === 'bigint' ? gasPrice : BigInt(gasPrice),
      ),
  );

export const signAndSendTransaction = (
  web3: Web3,
  signer: Web3Account,
  txData: Parameters<Web3['eth']['accounts']['signTransaction']>[0],
) =>
  Effect.gen(function* () {
    const signedTx = yield* Effect.tryPromise(() =>
      web3.eth.accounts.signTransaction(txData, signer.privateKey),
    );
    return yield* Effect.tryPromise(() =>
      web3.eth.sendSignedTransaction(signedTx.rawTransaction),
    );
  });

export const axiosGet = (
  url: string,
  config?: AxiosRequestConfig,
): Effect.Effect<AxiosResponse, Error, never> =>
  Effect.tryPromise({
    try: () => axios.get(url, config),
    catch: error =>
      new Error(
        `Failed to fetch ${url} : ${(error as Error)?.message ?? String(error)}`,
      ),
  });

export const getRpcFromNetworkOrRpcUrl = (
  network: Option.Option<NetworkName>,
  rpcUrlInput: Option.Option<URL>,
): Effect.Effect<string, Error, never> =>
  Effect.gen(function* () {
    if (Option.isSome(rpcUrlInput)) {
      return rpcUrlInput.value.toString();
    }
    if (Option.isSome(network)) {
      return getOptionalRpcUrl(network.value);
    }
    return yield* Effect.fail(new Error('Need one of --network or --rpc-url'));
  });
