import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';

export const deployedNetworks = [
  'arbitrum-sepolia',
  'aurora-testnet',
  'avalanche-fuji',
  'base-sepolia',
  'berachain-bartio',
  'blast-sepolia',
  'bsc-testnet',
  'celo-alfajores',
  'citrea-testnet',
  'cronos-testnet',
  'ethereum-holesky',
  'ethereum-sepolia',
  'fantom-testnet',
  'flare-coston',
  'harmony-testnet-shard0',
  'horizen-gobi',
  'inevm-testnet',
  'ink-sepolia',
  'kroma-sepolia',
  'linea-sepolia',
  'manta-sepolia',
  'mantle-sepolia',
  'mezo-matsnet-testnet',
  'monad-testnet',
  'morph-holesky',
  'optimism-sepolia',
  'opbnb-testnet',
  'polygon-amoy',
  'polygon-zkevm-cardona',
  'rollux-testnet',
  'scroll-sepolia',
  'shape-sepolia',
  'songbird-coston',
  'sonic-blaze',
  'taiko-hekla',
  'telos-testnet',
  'world-chain-sepolia',
] satisfies NetworkName[];

export type Transaction = {
  gasUsed?: string;
  gas_used?: string;
  gas: string;
  gasPrice?: string;
  gas_price?: string;
  from: EthereumAddress;
  to: EthereumAddress;
} & (
  | { timestamp: string; timeStamp: never }
  | { timeStamp: string; timestamp: never }
);
