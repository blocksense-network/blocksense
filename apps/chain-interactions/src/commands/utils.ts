import { Option } from 'effect';
import express from 'express';
import client from 'prom-client';
import Web3 from 'web3';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import type {
  ChainId,
  EthereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';
import {
  getNetworkNameByChainId,
  isChainId,
  parseEthereumAddress,
  parseNetworkName,
} from '@blocksense/base-utils/evm';
import { color as c } from '@blocksense/base-utils/tty';

import { deployedMainnets, deployedTestnets } from './types';

export const startPrometheusServer = (host: string, port: number): void => {
  const app = express();
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
  app.listen(port, host, () => {
    console.log(
      c`{blue Prometheus metrics exposed at http://${host}:${port}/metrics}`,
    );
  });
};

export function filterSmallBalance(balance: string, threshold = 1e-6): number {
  return Number(balance) < threshold ? 0 : Number(balance);
}

export function getDefaultSequencerAddress(
  shouldUseMainnetSequencer: boolean,
): EthereumAddress {
  if (shouldUseMainnetSequencer) {
    return parseEthereumAddress(
      getOptionalEnvString(
        'SEQUENCER_ADDRESS_MAINNET',
        '0x1F412F1dBab58E41d37ba31115c811B0fBD10904',
      ),
    );
  } else {
    return parseEthereumAddress(
      getOptionalEnvString(
        'SEQUENCER_ADDRESS_TESTNET',
        '0xd756119012CcabBC59910dE0ecEbE406B5b952bE',
      ),
    );
  }
}

export function getNetworks(
  network: Option.Option<string>,
  rpcUrlInput: Option.Option<URL>,
  mainnet: boolean,
): Promise<Array<'unknown' | NetworkName>>;
export function getNetworks(
  network: Option.Option<string>,
  mainnet: boolean,
): NetworkName[];
export function getNetworks(
  network: Option.Option<string>,
  rpcUrlOrMainnet: Option.Option<URL> | boolean,
  maybeMainnet?: boolean,
) {
  const hasRpcUrlArg = typeof rpcUrlOrMainnet !== 'boolean';
  const rpcUrlInput = hasRpcUrlArg
    ? (rpcUrlOrMainnet as Option.Option<URL>)
    : Option.none<URL>();
  const mainnet = hasRpcUrlArg
    ? (maybeMainnet ?? false)
    : (rpcUrlOrMainnet as boolean);

  let networks: Array<'unknown' | NetworkName> | undefined = mainnet
    ? deployedMainnets
    : deployedTestnets;
  if (Option.isSome(network)) {
    networks = [parseNetworkName(network.value)];
  }

  if (!hasRpcUrlArg) {
    return networks;
  }

  if (Option.isNone(rpcUrlInput)) {
    return Promise.resolve(networks);
  }

  return (async () => {
    let chainId: number | bigint | undefined;
    try {
      const web3 = new Web3(String(rpcUrlInput.value));
      chainId = await web3.eth.net.getId();
    } catch (e) {
      console.error(
        c`{red Failed to fetch chain ID from (RPC: ${rpcUrlInput.value})}`,
        (e as Error).message,
      );
    }
    if (chainId !== undefined && isChainId(Number(chainId))) {
      const chainIdNum = Number(chainId) as ChainId;
      const networkName = getNetworkNameByChainId(chainIdNum);
      return [networkName];
    }

    console.log(
      c`{red Could not determine network name from chain ID ${String(chainId)}.}`,
    );
    return ['unknown'];
  })();
}
