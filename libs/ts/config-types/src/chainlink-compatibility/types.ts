import { Schema as S } from 'effect';

import { keysOf, valuesOf } from '@blocksense/base-utils';
import { ethereumAddress } from '@blocksense/base-utils/evm';

export const chainlinkNetworkNameToChainId = {
  'avalanche-fuji-testnet': 'avalanche-fuji',
  'avalanche-mainnet': 'avalanche-mainnet',
  'bsc-mainnet': 'bsc-mainnet',
  'bsc-testnet': 'bsc-testnet',
  'celo-mainnet': 'celo-mainnet',
  'celo-testnet-alfajores': null,
  'ethereum-mainnet-andromeda-1': 'metis-andromeda-mainnet',
  'ethereum-mainnet-arbitrum-1': 'arbitrum-mainnet',
  'ethereum-mainnet-base-1': 'base-mainnet',
  'ethereum-mainnet-linea-1': 'linea-mainnet',
  'ethereum-mainnet-optimism-1': 'optimism-mainnet',
  'ethereum-mainnet-polygon-zkevm-1': 'polygon-zkevm-mainnet',
  'ethereum-mainnet-scroll-1': 'scroll-mainnet',
  'ethereum-mainnet-starknet-1': null,
  'ethereum-mainnet-zksync-1': 'zksync-mainnet',
  'ethereum-testnet-sepolia-arbitrum-1': 'arbitrum-sepolia',
  'ethereum-testnet-sepolia-base-1': 'base-sepolia',
  'ethereum-testnet-sepolia-optimism-1': 'optimism-sepolia',
  'ethereum-testnet-sepolia-polygon-zkevm-1': 'polygon-zkevm-cardona',
  'ethereum-testnet-sepolia-scroll-1': 'scroll-sepolia',
  'ethereum-testnet-sepolia-starknet-1': null,
  'ethereum-testnet-sepolia-zksync-1': 'zksync-sepolia',
  'ethereum-testnet-sepolia': 'ethereum-sepolia',
  'fantom-mainnet': 'fantom-mainnet',
  'fantom-testnet': 'fantom-testnet',
  'kusama-mainnet-moonriver': 'kusama-moonriver',
  mainnet: 'ethereum-mainnet',
  'matic-mainnet': 'polygon-mainnet',
  'polkadot-mainnet-moonbeam': null,
  'polygon-testnet-amoy': 'polygon-amoy',
  'solana-devnet': null,
  'solana-mainnet': null,
  'xdai-mainnet': 'gnosis-mainnet',
} as const;

export const chainlinkNetworkName = S.Literal(
  ...keysOf(chainlinkNetworkNameToChainId),
).annotations({ identifier: 'ChainlinkNetworkFilename' });

export type ChainlinkNetworkName = typeof chainlinkNetworkName.Type;

export function parseNetworkFilename(filename: string): ChainlinkNetworkName {
  const fName = S.decodeUnknownSync(chainlinkSupportedNetworkFileName)(
    filename,
  );
  return fName.slice(6, -5) as ChainlinkNetworkName;
}

export const chainlinkSupportedNetworkFileName = S.TemplateLiteral(
  S.Literal('feeds-'),
  chainlinkNetworkName,
  S.Literal('.json'),
);

export type ChainlinkSupportedNetworkFileName =
  typeof chainlinkSupportedNetworkFileName.Type;

export const isChainlinkSupportedNetworkFileName = S.is(
  chainlinkSupportedNetworkFileName,
);

export const ChainlinkAggregatorsSchema = S.Struct(
  Object.fromEntries(
    valuesOf(chainlinkNetworkNameToChainId)
      .filter(x => x !== null)
      .map(name => [name, S.optional(ethereumAddress)] as const),
  ),
).annotations({ identifier: 'ChainlinkAggregators' });

export type ChainlinkAggregators = typeof ChainlinkAggregatorsSchema.Type;

export const ChainlinkCompatibilityDataSchema = S.Struct({
  base: S.NullOr(ethereumAddress),
  quote: S.NullOr(ethereumAddress),
  chainlink_aggregators: ChainlinkAggregatorsSchema,
}).annotations({ identifier: 'ChainlinkCompatibilityData' });

export type ChainlinkCompatibilityData =
  typeof ChainlinkCompatibilityDataSchema.Type;

export const BlocksenseFeedsCompatibilitySchema = S.Record({
  key: S.String,
  value: S.Struct({
    id: S.BigInt,
    description: S.String,
    chainlink_compatibility: ChainlinkCompatibilityDataSchema,
  }),
}).annotations({ identifier: 'BlocksenseFeedsCompatibility' });

export type BlocksenseFeedsCompatibility =
  typeof BlocksenseFeedsCompatibilitySchema.Type;

export const ChainlinkAddressToBlocksenseIdSchema = S.Record({
  key: S.String,
  value: S.NullishOr(S.BigInt),
}).annotations({ identifier: 'ChainlinkAddressToBlocksenseId' });

export type ChainlinkAddressToBlocksenseId =
  typeof ChainlinkAddressToBlocksenseIdSchema.Type;

export const ChainlinkCompatibilityConfigSchema = S.Struct({
  blocksenseFeedsCompatibility: BlocksenseFeedsCompatibilitySchema,
  chainlinkAddressToBlocksenseId: ChainlinkAddressToBlocksenseIdSchema,
}).annotations({ identifier: 'ChainlinkCompatibilityConfig' });

export type ChainlinkCompatibilityConfig =
  typeof ChainlinkCompatibilityConfigSchema.Type;

export const decodeChainlinkCompatibilityConfig = S.decodeUnknownSync(
  ChainlinkCompatibilityConfigSchema,
);
