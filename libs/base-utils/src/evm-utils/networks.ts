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
import { InverseOf } from '../type-level';

const networks = [
  'ethereum-mainnet',
  'ethereum-sepolia',
  'ethereum-holesky',
  'avalanche-mainnet',
  'avalanche-fuji',
  'andromeda-mainnet',
  'arbitrum-mainnet',
  'arbitrum-sepolia',
  'artio-mainnet',
  'base-mainnet',
  'base-sepolia',
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
  'optimism-mainnet',
  'optimism-sepolia',
  'polygon-mainnet',
  'polygon-amoy',
  'polygon-zkevm-mainnet',
  'polygon-zkevm-sepolia',
  'scroll-mainnet',
  'scroll-sepolia',
  'specular-mainnet',
  'zksync-mainnet',
  'zksync-sepolia',
] as const;

const chainIds = [
  1, 11155111, 17000, 43114, 43113, 1088, 42161, 421614, 80085, 8453, 84532, 56,
  97, 42220, 44787, 250, 4002, 100, 10200, 167000, 167009, 59140, 59141, 169,
  3441006, 10, 11155420, 137, 80002, 1101, 1442, 534352, 534351, 13527, 324,
  300,
] as const;

export const networkName = S.Literal(...networks);
export const isNetworkName = S.is(networkName);
export const parseNetworkName = S.encodeSync(networkName);
export type NetworkName = S.Schema.Type<typeof networkName>;

export const chainId = S.Literal(...chainIds);
export const isChainId = S.is(chainId);
export const parseChainId = S.encodeSync(chainId);
export type ChainId = S.Schema.Type<typeof chainId>;

export const network = S.Union(networkName, chainId);
export const isNetwork = S.is(network);
export const parseNetwork = S.encodeSync(network);
export type Network = S.Schema.Type<typeof network>;

/**
 * Maps network names to their corresponding chain IDs.
 *
 * @remarks
 * The `networkNameToChainId` constant is a mapping object that associates network names with their respective chain IDs.
 * The keys of the object are the network names, and the values are the corresponding chain IDs.
 *
 * Example:
 * ```typescript
 * networkNameToChainId.mainnet; // Returns 1
 * networkNameToChainId.sepolia; // Returns 11155111
 * networkNameToChainId.holesky; // Returns 17000
 * ```
 */
export const networkNameToChainId = {
  'ethereum-mainnet': 1,
  'ethereum-sepolia': 11155111,
  'ethereum-holesky': 17000,
  'avalanche-mainnet': 43114,
  'avalanche-fuji': 43113,
  'andromeda-mainnet': 1088,
  'arbitrum-mainnet': 42161,
  'arbitrum-sepolia': 421614,
  'artio-mainnet': 80085,
  'base-mainnet': 8453,
  'base-sepolia': 84532,
  'bsc-mainnet': 56,
  'bsc-testnet': 97,
  'celo-mainnet': 42220,
  'celo-alfajores': 44787,
  'fantom-mainnet': 250,
  'fantom-testnet': 4002,
  'gnosis-mainnet': 100,
  'gnosis-chiado': 10200,
  'taiko-mainnet': 167000,
  'taiko-hekla': 167009,
  'linea-mainnet': 59140,
  'linea-sepolia': 59141,
  'manta-mainnet': 169,
  'manta-sepolia': 3441006,
  'optimism-mainnet': 10,
  'optimism-sepolia': 11155420,
  'polygon-mainnet': 137,
  'polygon-amoy': 80002,
  'polygon-zkevm-mainnet': 1101,
  'polygon-zkevm-sepolia': 1442,
  'scroll-mainnet': 534352,
  'scroll-sepolia': 534351,
  'specular-mainnet': 13527,
  'zksync-mainnet': 324,
  'zksync-sepolia': 300,
} satisfies {
  [Net in NetworkName]: ChainId;
};

/**
 * Converts a chain ID to its corresponding network name.
 *
 * @param chainId - The chain ID to convert.
 * @returns The network name associated with the given chain ID.
 *
 * Example:
 * ```typescript
 * chainIdToNetworkName[1]; // Returns 'mainnet'
 * chainIdToNetworkName[11155111]; // Returns 'sepolia'
 * chainIdToNetworkName[17000]; // Returns 'holesky'
 * ```
 */
export const chainIdToNetworkName = {
  1: 'ethereum-mainnet',
  11155111: 'ethereum-sepolia',
  17000: 'ethereum-holesky',
  43114: 'avalanche-mainnet',
  43113: 'avalanche-fuji',
  1088: 'andromeda-mainnet',
  42161: 'arbitrum-mainnet',
  421614: 'arbitrum-sepolia',
  80085: 'artio-mainnet',
  8453: 'base-mainnet',
  84532: 'base-sepolia',
  56: 'bsc-mainnet',
  97: 'bsc-testnet',
  42220: 'celo-mainnet',
  44787: 'celo-alfajores',
  250: 'fantom-mainnet',
  4002: 'fantom-testnet',
  100: 'gnosis-mainnet',
  10200: 'gnosis-chiado',
  167000: 'taiko-mainnet',
  167009: 'taiko-hekla',
  59140: 'linea-mainnet',
  59141: 'linea-sepolia',
  169: 'manta-mainnet',
  3441006: 'manta-sepolia',
  10: 'optimism-mainnet',
  11155420: 'optimism-sepolia',
  137: 'polygon-mainnet',
  80002: 'polygon-amoy',
  1101: 'polygon-zkevm-mainnet',
  1442: 'polygon-zkevm-sepolia',
  534352: 'scroll-mainnet',
  534351: 'scroll-sepolia',
  13527: 'specular-mainnet',
  324: 'zksync-mainnet',
  300: 'zksync-sepolia',
} satisfies InverseOf<typeof networkNameToChainId>;

/**
 * Mapping of network names to explorer URLs
 * The URL generator functions take a transaction hash or an address as input and return the corresponding explorer URL.
 */
export const explorerUrls: Record<string, any> = {
  'ethereum-mainnet': {
    tx: txHash => `https://etherscan.io/tx/${txHash}`,
    address: address => `https://etherscan.io/address/${address}`,
  },
  'ethereum-sepolia': {
    tx: txHash => `https://sepolia.etherscan.io/tx/${txHash}`,
    address: address => `https://sepolia.etherscan.io/address/${address}`,
  },
  'ethereum-holesky': {
    tx: txHash => `https://holesky.etherscan.io/tx/${txHash}`,
    address: address => `https://holesky.etherscan.io/address/${address}`,
  },
  'avalanche-mainnet': {
    tx: txHash => `https://snowtrace.io/tx/${txHash}`,
    address: address => `https://snowtrace.io/address/${address}`,
  },
  'avalanche-fuji': {
    tx: txHash => `https://testnet.snowtrace.io/tx/${txHash}`,
    address: address => `https://testnet.snowtrace.io/address/${address}`,
  },
  'andromeda-mainnet': {
    tx: txHash => `https://andromeda.guru.com/tx/${txHash}`,
    address: address => `https://andromeda.guru.com/address/${address}`,
  },
  'arbitrum-mainnet': {
    tx: txHash => `https://arbiscan.io/tx/${txHash}`,
    address: address => `https://arbiscan.io/address/${address}`,
  },
  'arbitrum-sepolia': {
    tx: txHash => `https://sepolia.arbiscan.io/tx/${txHash}`,
    address: address => `https://sepolia.arbiscan.io/address/${address}`,
  },
  'artio-mainnet': {
    tx: txHash => `https://artio.beratrail.io/tx/${txHash}`,
    address: address => `https://artio.beratrail.io/address/${address}`,
  },
  'base-mainnet': {
    tx: txHash => `https://basescan.org/tx/${txHash}`,
    address: address => `https://basescan.org/address/${address}`,
  },
  'base-sepolia': {
    tx: txHash => `https://sepolia.basescan.org/tx/${txHash}`,
    address: address => `https://sepolia.basescan.org/address/${address}`,
  },
  'bsc-mainnet': {
    tx: txHash => `https://bscscan.com/tx/${txHash}`,
    address: address => `https://bscscan.com/address/${address}`,
  },
  'bsc-testnet': {
    tx: txHash => `https://testnet.bscscan.com/tx/${txHash}`,
    address: address => `https://testnet.bscscan.com/address/${address}`,
  },
  'celo-mainnet': {
    tx: txHash => `https://celoscan.com/tx/${txHash}`,
    address: address => `https://celoscan.com/address/${address}`,
  },
  'celo-alfajores': {
    tx: txHash => `https://alfajores.celoscan.com/tx/${txHash}`,
    address: address => `https://alfajores.celoscan.com/address/${address}`,
  },
  'fantom-mainnet': {
    tx: txHash => `https://ftmscan.com/tx/${txHash}`,
    address: address => `https://ftmscan.com/address/${address}`,
  },
  'fantom-testnet': {
    tx: txHash => `https://testnet.ftmscan.com/tx/${txHash}`,
    address: address => `https://testnet.ftmscan.com/address/${address}`,
  },
  'gnosis-mainnet': {
    tx: txHash => `https://gnosisscan.io/tx/${txHash}`,
    address: address => `https://gnosisscan.io/address/${address}`,
  },
  'gnosis-chiado': {
    tx: txHash => `https://gnosis-chiado.blockscout.com/tx/${txHash}`,
    address: address =>
      `https://gnosis-chiado.blockscout.com/address/${address}`,
  },
  'taiko-mainnet': {
    tx: txHash => `https://taikoscan.io/tx/${txHash}`,
    address: address => `https://taikoscan.io/address/${address}`,
  },
  'taiko-hekla': {
    tx: txHash => `https://hekla.taikoscan.io/tx/${txHash}`,
    address: address => `https://hekla.taikoscan.io/address/${address}`,
  },
  'linea-mainnet': {
    tx: txHash => `https://lineascan.build/tx/${txHash}`,
    address: address => `https://lineascan.build/address/${address}`,
  },
  'linea-sepolia': {
    tx: txHash => `https://sepolia.lineascan.build/tx/${txHash}`,
    address: address => `https://sepolia.lineascan.build/address/${address}`,
  },
  'manta-mainnet': {
    tx: txHash => `https://pacific-explorer.manta.network/tx/${txHash}`,
    address: address =>
      `https://pacific-explorer.manta.network/address/${address}`,
  },
  'manta-sepolia': {
    tx: txHash => `https://pacific-explorer.sepolia.manta.network/tx/${txHash}`,
    address: address =>
      `https://pacific-explorer.sepolia-testnet.manta.network/address/${address}`,
  },
  'optimism-mainnet': {
    tx: txHash => `https://optimistic.etherscan.io/tx/${txHash}`,
    address: address => `https://optimistic.etherscan.io/address/${address}`,
  },
  'optimism-sepolia': {
    tx: txHash => `https://sepolia-optimism.etherscan.io/tx/${txHash}`,
    address: address =>
      `https://sepolia-optimism.etherscan.io/address/${address}`,
  },
  'polygon-mainnet': {
    tx: txHash => `https://polygonscan.com/tx/${txHash}`,
    address: address => `https://polygonscan.com/address/${address}`,
  },
  'polygon-amoy': {
    tx: txHash => `https://amoy.polygonscan.com/tx/${txHash}`,
    address: address => `https://amoy.polygonscan.com/address/${address}`,
  },
  'polygon-zkevm-mainnet': {
    tx: txHash => `https://zkevm.polygonscan.com/tx/${txHash}`,
    address: address => `https://zkevm.polygonscan.com/address/${address}`,
  },
  'scroll-mainnet': {
    tx: txHash => `https://scroll.io/tx/${txHash}`,
    address: address => `https://scroll.io/address/${address}`,
  },
  'scroll-sepolia': {
    tx: txHash => `https://sepolia.scrollscan.com/tx/${txHash}`,
    address: address => `https://sepolia.scrollscan.com/address/${address}`,
  },
  'zksync-mainnet': {
    tx: txHash => `https://zksync.io/tx/${txHash}`,
    address: address => `https://zksync.io/address/${address}`,
  },
  'zksync-sepolia': {
    tx: txHash => `https://zksync-sepolia.blockscout.com/tx/${txHash}`,
    address: address =>
      `https://zksync-sepolia.blockscout.com/address/${address}`,
  },
} satisfies {
  [network in NetworkName]?: {
    tx: (tx: TxHash) => string;
    address: (address: EthereumAddress) => string;
  };
};

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
