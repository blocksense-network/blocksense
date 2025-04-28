import { BigInt as EFBigInt, ParseResult, Schema as S } from 'effect';

import { NetworkName, ethereumAddress } from '@blocksense/base-utils/evm';

export const chainlinkSupportedNetworkFileNames = [
  'feeds-aptos-mainnet.json',
  'feeds-aptos-testnet.json',
  'feeds-avalanche-fuji-testnet.json',
  'feeds-avalanche-mainnet.json',
  'feeds-bitcoin-testnet-botanix.json',
  'feeds-bsc-mainnet.json',
  'feeds-bsc-testnet.json',
  'feeds-celo-mainnet.json',
  'feeds-celo-testnet-alfajores.json',
  'feeds-ethereum-mainnet-andromeda-1.json',
  'feeds-ethereum-mainnet-arbitrum-1.json',
  'feeds-ethereum-mainnet-base-1.json',
  'feeds-ethereum-mainnet-linea-1.json',
  'feeds-ethereum-mainnet-mantle-1.json',
  'feeds-ethereum-mainnet-optimism-1.json',
  'feeds-ethereum-mainnet-polygon-zkevm-1.json',
  'feeds-ethereum-mainnet-scroll-1.json',
  'feeds-ethereum-mainnet-starknet-1.json',
  'feeds-ethereum-mainnet-xlayer-1.json',
  'feeds-ethereum-mainnet-zksync-1.json',
  'feeds-ethereum-testnet-sepolia-arbitrum-1.json',
  'feeds-ethereum-testnet-sepolia-base-1.json',
  'feeds-ethereum-testnet-sepolia-mantle-1.json',
  'feeds-ethereum-testnet-sepolia-optimism-1.json',
  'feeds-ethereum-testnet-sepolia-polygon-zkevm-1.json',
  'feeds-ethereum-testnet-sepolia-scroll-1.json',
  'feeds-ethereum-testnet-sepolia-soneium-1.json',
  'feeds-ethereum-testnet-sepolia-starknet-1.json',
  'feeds-ethereum-testnet-sepolia-unichain-1.json',
  'feeds-ethereum-testnet-sepolia-zksync-1.json',
  'feeds-ethereum-testnet-sepolia-xlayer-1.json',
  'feeds-ethereum-testnet-sepolia.json',
  'feeds-fantom-mainnet.json',
  'feeds-fantom-testnet.json',
  'feeds-hedera-mainnet.json',
  'feeds-hedera-testnet.json',
  'feeds-kusama-mainnet-moonriver.json',
  'feeds-mainnet.json',
  'feeds-matic-mainnet.json',
  'feeds-polkadot-mainnet-moonbeam.json',
  'feeds-polygon-testnet-amoy.json',
  'feeds-ronin-mainnet.json',
  'feeds-ronin-saigon-testnet.json',
  'feeds-solana-devnet.json',
  'feeds-solana-mainnet.json',
  'feeds-soneium-mainnet.json',
  'feeds-sonic-mainnet.json',
  'feeds-sonic-testnet-blaze.json',
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

export type ChainlinkNetworkName =
  ChainlinkSupportedNetworkFileName extends `feeds-${infer U}.json` ? U : never;

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

export function parseNetworkFilename(filename: unknown): ChainlinkNetworkName {
  if (!isChainlinkSupportedNetworkFileName(filename)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return S.decodeSync(transformedSchema)(filename) as ChainlinkNetworkName;
}

export const chainlinkNetworkNameToChainId = {
  'aptos-mainnet': null,
  'aptos-testnet': null,
  'avalanche-fuji-testnet': 'avalanche-fuji',
  'avalanche-mainnet': 'avalanche-mainnet',
  'bitcoin-testnet-botanix': null,
  'bsc-mainnet': 'bsc-mainnet',
  'bsc-testnet': 'bsc-testnet',
  'celo-mainnet': 'celo-mainnet',
  'celo-testnet-alfajores': 'celo-alfajores',
  'ethereum-mainnet-andromeda-1': 'metis-andromeda-mainnet',
  'ethereum-mainnet-arbitrum-1': 'arbitrum-mainnet',
  'ethereum-mainnet-base-1': 'base-mainnet',
  'ethereum-mainnet-linea-1': 'linea-mainnet',
  'ethereum-mainnet-mantle-1': 'mantle-mainnet',
  'ethereum-mainnet-optimism-1': 'optimism-mainnet',
  'ethereum-mainnet-polygon-zkevm-1': 'polygon-zkevm-mainnet',
  'ethereum-mainnet-scroll-1': 'scroll-mainnet',
  'ethereum-mainnet-starknet-1': null,
  'ethereum-mainnet-xlayer-1': null,
  'ethereum-mainnet-zksync-1': 'zksync-mainnet',
  'ethereum-testnet-sepolia-arbitrum-1': 'arbitrum-sepolia',
  'ethereum-testnet-sepolia-base-1': 'base-sepolia',
  'ethereum-testnet-sepolia-mantle-1': 'mantle-sepolia',
  'ethereum-testnet-sepolia-optimism-1': 'optimism-sepolia',
  'ethereum-testnet-sepolia-polygon-zkevm-1': 'polygon-zkevm-cardona',
  'ethereum-testnet-sepolia-scroll-1': 'scroll-sepolia',
  'ethereum-testnet-sepolia-soneium-1': 'soneium-minato',
  'ethereum-testnet-sepolia-starknet-1': null,
  'ethereum-testnet-sepolia-unichain-1': 'unichain-sepolia',
  'ethereum-testnet-sepolia-xlayer-1': null,
  'ethereum-testnet-sepolia-zksync-1': 'zksync-sepolia',
  'ethereum-testnet-sepolia': 'ethereum-sepolia',
  'fantom-mainnet': 'fantom-mainnet',
  'fantom-testnet': 'fantom-testnet',
  'hedera-mainnet': null,
  'hedera-testnet': null,
  'kusama-mainnet-moonriver': 'kusama-moonriver',
  mainnet: 'ethereum-mainnet',
  'matic-mainnet': 'polygon-mainnet',
  'polkadot-mainnet-moonbeam': 'kusama-moonbeam',
  'polygon-testnet-amoy': 'polygon-amoy',
  'ronin-mainnet': 'ronin-mainnet',
  'ronin-saigon-testnet': null,
  'solana-devnet': null,
  'solana-mainnet': null,
  'soneium-mainnet': 'soneium-mainnet',
  'sonic-mainnet': 'sonic-mainnet',
  'sonic-testnet-blaze': 'sonic-blaze',
  'xdai-mainnet': 'gnosis-mainnet',
} satisfies {
  [Net in ChainlinkNetworkName]: NetworkName | null;
};

export class NumberFromBigInt extends S.transformOrFail(
  S.Union(S.BigIntFromSelf, S.Number),
  S.Number,
  {
    strict: true,
    encode: (n, _, ast) =>
      ParseResult.fromOption(
        EFBigInt.fromNumber(n),
        () => new ParseResult.Type(ast, n),
      ),
    decode: (b, _, ast) =>
      ParseResult.fromOption(
        EFBigInt.toNumber(BigInt(b)),
        () => new ParseResult.Type(ast, b),
      ),
  },
).annotations({ identifier: 'NumberFromBigInt' }) {}

export const ConfirmedFeedEvent = S.Struct({
  asset: ethereumAddress,
  denomination: ethereumAddress,
  latestAggregator: ethereumAddress,
  previousAggregator: ethereumAddress,
  nextPhaseId: NumberFromBigInt, // uint16 in Solidity
  sender: ethereumAddress,
});

export type ConfirmedFeedEvent = typeof ConfirmedFeedEvent.Type;

export const decodeConfirmedFeedEvent = S.decodeUnknownSync(ConfirmedFeedEvent);

export const FeedRegistryEventsPerAggregatorSchema = S.Record({
  key: ethereumAddress,
  value: ConfirmedFeedEvent,
});

export type FeedRegistryEventsPerAggregator =
  typeof FeedRegistryEventsPerAggregatorSchema.Type;

export const chainIdToChainlinkNetworkName = Object.entries(
  chainlinkNetworkNameToChainId,
).reduce(
  (acc, [chainlinkName, networkName]) => {
    if (networkName !== null) {
      acc[networkName] = chainlinkName as ChainlinkNetworkName;
    }
    return acc;
  },
  {} as Record<NetworkName, ChainlinkNetworkName>,
);

export function getChainlinkNetworkName(
  networkName: NetworkName,
): ChainlinkNetworkName {
  const name = chainIdToChainlinkNetworkName[networkName];
  if (!name) {
    throw new Error(
      `No Chainlink network name found for network: ${networkName}`,
    );
  }
  return name;
}

export function getChainlinkNetworkFilenameLinks(
  networkName: NetworkName,
): ChainlinkSupportedNetworkFileName {
  const name = chainIdToChainlinkNetworkName[networkName];
  if (!name) {
    throw new Error(
      `No Chainlink network name found for network: ${networkName}`,
    );
  }
  return `https://reference-data-directory.vercel.app/feeds-${name}.json` as ChainlinkSupportedNetworkFileName;
}
