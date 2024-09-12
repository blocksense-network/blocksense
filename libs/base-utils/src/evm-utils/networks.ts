/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import * as S from '@effect/schema/Schema';
import { InverseOf } from '../type-level';
import { EthereumAddress, TxHash } from './hex-types';

const networks = [
  'mainnet',
  'sepolia',
  'holesky',
  'amoy',
  'manta',
  'fuji',
  'chiado',
  'opSepolia',
  'zkSyncSepolia',
  'baseSepolia',
  'specular',
  'scrollSepolia',
  'arbSepolia',
  'artio',
  'hekla',
] as const;

const chainIds = [
  1, 11155111, 17000, 80002, 3441006, 43113, 10200, 11155420, 300, 84532, 13527,
  534351, 421614, 80085, 167009,
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
  mainnet: 1,
  sepolia: 11155111,
  holesky: 17000,
  amoy: 80002,
  manta: 3441006,
  fuji: 43113,
  chiado: 10200,
  opSepolia: 11155420,
  zkSyncSepolia: 300,
  baseSepolia: 84532,
  specular: 13527,
  scrollSepolia: 534351,
  arbSepolia: 421614,
  artio: 80085,
  hekla: 167009,
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
  1: 'mainnet',
  11155111: 'sepolia',
  17000: 'holesky',
  80002: 'amoy',
  3441006: 'manta',
  43113: 'fuji',
  10200: 'chiado',
  11155420: 'opSepolia',
  300: 'zkSyncSepolia',
  84532: 'baseSepolia',
  13527: 'specular',
  534351: 'scrollSepolia',
  421614: 'arbSepolia',
  80085: 'artio',
  167009: 'hekla',
} satisfies InverseOf<typeof networkNameToChainId>;

/**
 * Mapping of network names to explorer URL for transactions.
 * The URL generator function takes a transaction hash as input and returns the corresponding explorer URL.
 */
export const explorerUrls = {
  mainnet: txHash => `https://etherscan.io/tx/${txHash}`,
  sepolia: txHash => `https://sepolia.etherscan.io/tx/${txHash}`,
  holesky: txHash => `https://holesky.etherscan.io/tx/${txHash}`,
  amoy: txHash => `https://amoy.polygonscan.com/tx/${txHash}`,
  manta: txHash =>
    `https://pacific-explorer.sepolia-testnet.manta.network/tx/${txHash}`,
  fuji: txHash => `https://testnet.snowtrace.io/tx/${txHash}`,
  chiado: txHash => `https://gnosis-chiado.blockscout.com/tx/${txHash}`,
  opSepolia: txHash => `https://sepolia-optimism.etherscan.io/tx/${txHash}`,
  zkSyncSepolia: txHash => `https://sepolia.explorer.zksync.io/tx/${txHash}`,
  baseSepolia: txHash => `https://sepolia.basescan.org/tx/${txHash}`,
  specular: txHash => `https://explorer.specular.network/tx/${txHash}`,
  scrollSepolia: txHash => `https://sepolia.scrollscan.com/tx/${txHash}`,
  arbSepolia: txHash => `https://sepolia.arbiscan.io/tx/${txHash}`,
  artio: txHash => `https://artio.beratrail.io/tx/${txHash}`,
  hekla: txHash => `https://hekla.taikoscan.io/tx/${txHash}`,
} satisfies {
  [network in NetworkName]: (tx: TxHash) => string;
};

/**
 * Mapping of network names to explorer URL for smart contracts.
 * The URL generator function takes a smart contact address as input and returns the corresponding explorer URL.
 */
export const explorerAddressUrls = {
  mainnet: address => `https://etherscan.io/address/${address}`,
  sepolia: address => `https://sepolia.etherscan.io/address/${address}`,
  holesky: address => `https://holesky.etherscan.io/address/${address}`,
  amoy: address => `https://amoy.polygonscan.com/address/${address}`,
  manta: address =>
    `https://pacific-explorer.sepolia-testnet.manta.network/address/${address}`,
  fuji: address => `https://testnet.snowtrace.io/address/${address}`,
  chiado: address => `https://gnosis-chiado.blockscout.com/address/${address}`,
  opSepolia: address =>
    `https://sepolia-optimism.etherscan.io/address/${address}`,
  zkSyncSepolia: address =>
    `https://sepolia.explorer.zksync.io/address/${address}`,
  baseSepolia: address => `https://sepolia.basescan.org/address/${address}`,
  specular: address => `https://explorer.specular.network/address/${address}`,
  scrollSepolia: address => `https://sepolia.scrollscan.com/address/${address}`,
  arbSepolia: address => `https://sepolia.arbiscan.io/address/${address}`,
  artio: address => `https://artio.beratrail.io/address/${address}`,
  hekla: address => `https://hekla.taikoscan.io/address/${address}`,
} satisfies {
  [network in NetworkName]: (address: EthereumAddress) => string;
};
