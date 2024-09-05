import * as S from '@effect/schema/Schema';

import {
  chainId,
  ChainId,
  denominationAddress,
  ethereumAddress,
  networkNameToChainId,
} from '@blocksense/base-utils/evm-utils';
import { never } from 'effect/Fiber';

export const chainlinkSupportedNetworkFileNames = [
  'feeds-avalanche-fuji-testnet.json',
  'feeds-avalanche-mainnet.json',
  'feeds-bsc-mainnet.json',
  'feeds-bsc-testnet.json',
  'feeds-celo-mainnet.json',
  'feeds-celo-testnet-alfajores.json',
  'feeds-ethereum-mainnet-andromeda-1.json',
  'feeds-ethereum-mainnet-arbitrum-1.json',
  'feeds-ethereum-mainnet-base-1.json',
  'feeds-ethereum-mainnet-linea-1.json',
  'feeds-ethereum-mainnet-optimism-1.json',
  'feeds-ethereum-mainnet-polygon-zkevm-1.json',
  'feeds-ethereum-mainnet-scroll-1.json',
  'feeds-ethereum-mainnet-starknet-1.json',
  'feeds-ethereum-mainnet-zksync-1.json',
  'feeds-ethereum-testnet-sepolia-arbitrum-1.json',
  'feeds-ethereum-testnet-sepolia-base-1.json',
  'feeds-ethereum-testnet-sepolia-optimism-1.json',
  'feeds-ethereum-testnet-sepolia-polygon-zkevm-1.json',
  'feeds-ethereum-testnet-sepolia-scroll-1.json',
  'feeds-ethereum-testnet-sepolia-starknet-1.json',
  'feeds-ethereum-testnet-sepolia-zksync-1.json',
  'feeds-ethereum-testnet-sepolia.json',
  'feeds-fantom-mainnet.json',
  'feeds-fantom-testnet.json',
  'feeds-kusama-mainnet-moonriver.json',
  'feeds-mainnet.json',
  'feeds-matic-mainnet.json',
  'feeds-polkadot-mainnet-moonbeam.json',
  'feeds-polygon-testnet-amoy.json',
  'feeds-solana-devnet.json',
  'feeds-solana-mainnet.json',
  'feeds-xdai-mainnet.json',
] as const;

export const chainlinkSupportedNetworkFileName = S.Literal(
  ...chainlinkSupportedNetworkFileNames,
);

export type ChainlinkSupportedNetworkFileName = S.Schema.Type<
  typeof chainlinkSupportedNetworkFileName
>;
export const isChainlinkSupportedNetworkFileName = S.is(
  chainlinkSupportedNetworkFileName,
);

type ExtractedNetworkName<T extends string> = T extends `feeds-${infer U}.json`
  ? U
  : never;

export type NetworkName =
  ExtractedNetworkName<ChainlinkSupportedNetworkFileName>;

const transformedSchema = S.transform(
  // Source schema is the filename literal type
  chainlinkSupportedNetworkFileName,
  // Target schema is the network name extracted
  S.String,
  {
    strict: false,
    // Transform function to extract the network name
    decode: filename => {
      const match = filename.match(/^feeds-(.*)\.json$/);
      if (match) {
        return match[1]; // Extracted part
      }
      throw new Error(`Invalid filename: ${filename}`);
    },
    // Encode function to convert back from network name to full filename
    encode: networkName => `feeds-${networkName}.json`,
  },
);

export function parseNetworkName(filename: unknown): NetworkName {
  if (!isChainlinkSupportedNetworkFileName(filename)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return S.decodeSync(transformedSchema)(filename) as NetworkName;
}

export const chainlinkNetworkNameToChainId = {
  'avalanche-fuji-testnet': networkNameToChainId.fuji,
  'avalanche-mainnet': null,
  'bsc-mainnet': null,
  'bsc-testnet': null,
  'celo-mainnet': null,
  'celo-testnet-alfajores': null,
  'ethereum-mainnet-andromeda-1': null,
  'ethereum-mainnet-arbitrum-1': networkNameToChainId.arbSepolia,
  'ethereum-mainnet-base-1': null,
  'ethereum-mainnet-linea-1': null,
  'ethereum-mainnet-optimism-1': null,
  'ethereum-mainnet-polygon-zkevm-1': null,
  'ethereum-mainnet-scroll-1': null,
  'ethereum-mainnet-starknet-1': null,
  'ethereum-mainnet-zksync-1': null,
  'ethereum-testnet-sepolia-arbitrum-1': null,
  'ethereum-testnet-sepolia-base-1': networkNameToChainId.baseSepolia,
  'ethereum-testnet-sepolia-optimism-1': networkNameToChainId.opSepolia,
  'ethereum-testnet-sepolia-polygon-zkevm-1': null,
  'ethereum-testnet-sepolia-scroll-1': networkNameToChainId.scrollSepolia,
  'ethereum-testnet-sepolia-starknet-1': null,
  'ethereum-testnet-sepolia-zksync-1': networkNameToChainId.zkSyncSepolia,
  'ethereum-testnet-sepolia': networkNameToChainId.sepolia,
  'fantom-mainnet': null,
  'fantom-testnet': null,
  'kusama-mainnet-moonriver': null,
  mainnet: networkNameToChainId.mainnet,
  'matic-mainnet': null,
  'polkadot-mainnet-moonbeam': null,
  'polygon-testnet-amoy': networkNameToChainId.amoy,
  'solana-devnet': null,
  'solana-mainnet': null,
  'xdai-mainnet': null,
} satisfies {
  [Net in NetworkName]: ChainId | null;
};

const ChainlinkAggregatorProxySchema = S.Record({
  key: chainId,
  value: S.NullishOr(ethereumAddress),
});

export type ChainlinkAggregatorProxy = S.Schema.Type<
  typeof ChainlinkAggregatorProxySchema
>;

const ChainlinkCompatibilityDataSchema = S.Struct({
  base: S.NullishOr(denominationAddress),
  quote: S.NullishOr(denominationAddress),
  chainlink_aggregator_proxies: ChainlinkAggregatorProxySchema,
});

export type ChainlinkCompatibilityData = S.Schema.Type<
  typeof ChainlinkCompatibilityDataSchema
>;

const BlocksenseFeedsCompatibilitySchema = S.Record({
  key: S.String,
  value: S.Struct({
    id: S.Number,
    description: S.String,
    chainlink_compatibility: ChainlinkCompatibilityDataSchema,
  }),
});

export type BlocksenseFeedsCompatibility = S.Schema.Type<
  typeof BlocksenseFeedsCompatibilitySchema
>;

export const ChainlinkAddressToBlocksenseIdSchema = S.Record({
  key: S.String,
  value: S.NullishOr(S.Number),
});

export type ChainlinkAddressToBlocksenseId = S.Schema.Type<
  typeof ChainlinkAddressToBlocksenseIdSchema
>;

const ChainlinkCompatibilityConfigSchema = S.Struct({
  blocksenseFeedsCompatibility: BlocksenseFeedsCompatibilitySchema,
  chainlinkAddressToBlocksenseId: ChainlinkAddressToBlocksenseIdSchema,
});

export type ChainlinkCompatibilityConfig = S.Schema.Type<
  typeof ChainlinkCompatibilityConfigSchema
>;

export const decodeChainlinkCompatibilityConfig = S.decodeUnknownSync(
  ChainlinkCompatibilityConfigSchema,
);
