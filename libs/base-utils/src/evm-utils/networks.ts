/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as S from '@effect/schema/Schema';

import { getEnvString, getOptionalEnvString } from '../env';
import { EthereumAddress, TxHash } from './hex-types';
import { KebabToSnakeCase, kebabToSnakeCase } from '../string';
import { NumberFromSelfBigIntOrString } from '../numeric';

const networks = [
  'local',
  'ethereum-mainnet',
  'ethereum-sepolia',
  'ethereum-holesky',
  'avalanche-mainnet',
  'avalanche-fuji',
  'andromeda-mainnet',
  'arbitrum-mainnet',
  'arbitrum-sepolia',
  'base-mainnet',
  'base-sepolia',
  'berachain-bartio',
  'bsc-mainnet',
  'bsc-testnet',
  'celo-mainnet',
  'celo-alfajores',
  'fantom-mainnet',
  'fantom-testnet',
  'gnosis-mainnet',
  'gnosis-chiado',
  'taiko-mainnet',
  'taiko-hekla',
  'linea-mainnet',
  'linea-sepolia',
  'manta-mainnet',
  'manta-sepolia',
  'kusama-moonriver',
  'optimism-mainnet',
  'optimism-sepolia',
  'polygon-mainnet',
  'polygon-amoy',
  'polygon-zkevm-mainnet',
  'polygon-zkevm-cardona',
  'scroll-mainnet',
  'scroll-sepolia',
  'zksync-mainnet',
  'zksync-sepolia',
] as const;

const chainIds = [
  1, 11155111, 17000, 43114, 43113, 1088, 42161, 421614, 8453, 84532, 80084, 56,
  97, 42220, 44787, 250, 4002, 100, 10200, 167000, 167009, 59144, 59141, 169,
  3441006, 1285, 10, 11155420, 137, 80002, 1101, 2442, 534352, 534351, 324, 300,
] as const;

export const networkName = S.Literal(...networks);
export const isNetworkName = S.is(networkName);
export const parseNetworkName = S.decodeUnknownSync(networkName);
export type NetworkName = S.Schema.Type<typeof networkName>;

export const chainId = S.compose(
  NumberFromSelfBigIntOrString,
  S.Literal(...chainIds),
);
export const isChainId = S.is(chainId);
export const parseChainId = S.decodeUnknownSync(chainId);
export type ChainId = S.Schema.Type<typeof chainId>;

export const network = S.Union(networkName, chainId);
export const isNetwork = S.is(network);
export const parseNetwork = S.decodeUnknownSync(network);
export type Network = S.Schema.Type<typeof network>;

/**
 * Mapping of network names to explorer URLs
 * The URL generator functions take a transaction hash or an address as input and return the corresponding explorer URL.
 */
export const networkMetadata = {
  local: {
    isTestnet: false,
    chainId: undefined,
    explorerUrl: undefined,
  },
  'ethereum-mainnet': {
    chainId: 1,
    isTestnet: false,
    explorerUrl: 'https://etherscan.io',
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    isTestnet: true,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  'ethereum-holesky': {
    chainId: 17000,
    isTestnet: true,
    explorerUrl: 'https://holesky.etherscan.io',
  },
  'avalanche-mainnet': {
    chainId: 43114,
    isTestnet: false,
    explorerUrl: 'https://snowtrace.io',
  },
  'avalanche-fuji': {
    chainId: 43113,
    isTestnet: true,
    explorerUrl: 'https://testnet.snowtrace.io',
  },
  'andromeda-mainnet': {
    chainId: 1088,
    isTestnet: false,
    explorerUrl: 'https://andromeda.guru.com',
  },
  'arbitrum-mainnet': {
    chainId: 42161,
    isTestnet: false,
    explorerUrl: 'https://arbiscan.io',
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    isTestnet: true,
    explorerUrl: 'https://sepolia.arbiscan.io',
  },
  'base-mainnet': {
    chainId: 8453,
    isTestnet: false,
    explorerUrl: 'https://basescan.org',
  },
  'base-sepolia': {
    chainId: 84532,
    isTestnet: true,
    explorerUrl: 'https://sepolia.basescan.org',
  },
  'berachain-bartio': {
    chainId: 80084,
    isTestnet: true,
    explorerUrl: 'https://bartio.beratrail.io',
  },
  'bsc-mainnet': {
    chainId: 56,
    isTestnet: false,
    explorerUrl: 'https://bscscan.com',
  },
  'bsc-testnet': {
    chainId: 97,
    isTestnet: true,
    explorerUrl: 'https://testnet.bscscan.com',
  },
  'celo-mainnet': {
    chainId: 42220,
    isTestnet: false,
    explorerUrl: 'https://celoscan.com',
  },
  'celo-alfajores': {
    chainId: 44787,
    isTestnet: true,
    explorerUrl: 'https://alfajores.celoscan.com',
  },
  'fantom-mainnet': {
    chainId: 250,
    isTestnet: false,
    explorerUrl: 'https://ftmscan.com',
  },
  'fantom-testnet': {
    chainId: 4002,
    isTestnet: true,
    explorerUrl: 'https://testnet.ftmscan.com',
  },
  'gnosis-mainnet': {
    chainId: 100,
    isTestnet: false,
    explorerUrl: 'https://gnosisscan.io',
  },
  'gnosis-chiado': {
    chainId: 10200,
    isTestnet: true,
    explorerUrl: 'https://gnosis-chiado.blockscout.com',
  },
  'taiko-mainnet': {
    chainId: 167000,
    isTestnet: false,
    explorerUrl: 'https://taikoscan.io',
  },
  'taiko-hekla': {
    chainId: 167009,
    isTestnet: true,
    explorerUrl: 'https://hekla.taikoscan.io',
  },
  'linea-mainnet': {
    chainId: 59144,
    isTestnet: false,
    explorerUrl: 'https://lineascan.build',
  },
  'linea-sepolia': {
    chainId: 59141,
    isTestnet: true,
    explorerUrl: 'https://sepolia.lineascan.build',
  },
  'manta-mainnet': {
    chainId: 169,
    isTestnet: false,
    explorerUrl: 'https://pacific-explorer.manta.network',
  },
  'manta-sepolia': {
    chainId: 3441006,
    isTestnet: true,
    explorerUrl: '    `https://pacific-explorer.sepolia-testnet.manta.network',
  },
  'kusama-moonriver': {
    chainId: 1285,
    isTestnet: false,
    explorerUrl: 'https://moonriver.moonscan.io',
  },
  'optimism-mainnet': {
    chainId: 10,
    isTestnet: false,
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  'optimism-sepolia': {
    chainId: 11155420,
    isTestnet: true,
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
  },
  'polygon-mainnet': {
    chainId: 137,
    isTestnet: false,
    explorerUrl: 'https://polygonscan.com',
  },
  'polygon-amoy': {
    chainId: 80002,
    isTestnet: true,
    explorerUrl: 'https://amoy.polygonscan.com',
  },
  'polygon-zkevm-mainnet': {
    chainId: 1101,
    isTestnet: false,
    explorerUrl: 'https://zkevm.polygonscan.com',
  },
  'polygon-zkevm-cardona': {
    chainId: 2442,
    isTestnet: true,
    explorerUrl: 'https://cardona-zkevm.polygonscan.com',
  },
  'scroll-mainnet': {
    chainId: 534352,
    isTestnet: false,
    explorerUrl: 'https://scroll.io',
  },
  'scroll-sepolia': {
    chainId: 534351,
    isTestnet: true,
    explorerUrl: 'https://sepolia.scrollscan.com',
  },
  'zksync-mainnet': {
    chainId: 324,
    isTestnet: false,
    explorerUrl: 'https://zksync.blockscout.com',
  },
  'zksync-sepolia': {
    chainId: 300,
    isTestnet: true,
    explorerUrl: 'https://zksync-sepolia.blockscout.com',
  },
} satisfies {
  [Net in NetworkName]: {
    chainId: ChainId | undefined;
    isTestnet: boolean;
    explorerUrl: string | undefined;
  };
};

export function isTestnet<Net extends NetworkName>(
  network: Net,
): (typeof networkMetadata)[Net]['isTestnet'] {
  return networkMetadata[network].isTestnet;
}

export function getTxHashExplorerUrl(
  network: NetworkName,
  txhash: TxHash,
): string {
  return `${networkMetadata[network].explorerUrl}/tx/${txhash}`;
}

export function getAddressExplorerUrl(
  network: NetworkName,
  address: EthereumAddress,
): string {
  return `${networkMetadata[network].explorerUrl}/address/${address}`;
}

export type NetworkNameToEnvVar<Net extends NetworkName> =
  `RPC_URL_${KebabToSnakeCase<Net>}`;

export type RpcUrlEnvVarNames = NetworkNameToEnvVar<NetworkName>;

export function getRpcUrlEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToEnvVar<Net> {
  return `RPC_URL_${kebabToSnakeCase(network)}`;
}

export function getRpcUrl(network: NetworkName): string {
  const envVar = getRpcUrlEnvVar(network);
  return getEnvString(envVar);
}

export function getOptionalRpcUrl(network: NetworkName): string {
  const envVar = getRpcUrlEnvVar(network);
  return getOptionalEnvString(envVar, '');
}

export function getNetworkNameByChainId(chainId: ChainId): NetworkName {
  for (const [network, metadata] of Object.entries(networkMetadata)) {
    if (metadata.chainId === chainId) {
      return parseNetworkName(network);
    }
  }
  throw new Error(`Unknown network for Chain Id: ${chainId}`);
}
