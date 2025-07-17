import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';

export const deployedNetworks = [
  'abstract-testnet',
  'arbitrum-sepolia',
  'aurora-testnet',
  'avalanche-fuji',
  'base-sepolia',
  'basecamp-testnet',
  'berachain-bepolia',
  'bitlayer-testnet',
  'blast-sepolia',
  'bsc-testnet',
  'celo-alfajores',
  'citrea-testnet',
  'creator-chain-testnet',
  'cronos-testnet',
  'cyber-testnet',
  'ethereum-holesky',
  'ethereum-sepolia',
  'expchain-testnet',
  'fantom-testnet',
  'flare-coston',
  'fraxtal-testnet',
  'gameswift-chain-testnet',
  'harmony-testnet-shard0',
  'hemi-sepolia',
  'hoodi-testnet',
  'horizen-gobi',
  'hyperliquid-evm-testnet',
  'inevm-testnet',
  'ink-sepolia',
  'kava-testnet',
  'kusama-moonbase-alpha',
  'linea-sepolia',
  'lisk-sepolia',
  'manta-sepolia',
  'mantle-sepolia',
  'megaeth-testnet',
  'metal-l2-testnet',
  'mezo-matsnet-testnet',
  'monad-testnet',
  'morph-holesky',
  'nexera-testnet',
  'ontology-testnet',
  'opbnb-testnet',
  'optimism-sepolia',
  'pharos-testnet',
  'plume-testnet',
  'polygon-amoy',
  'polygon-zkevm-cardona',
  'rise-testnet',
  'rootstock-testnet',
  'scroll-sepolia',
  'shape-sepolia',
  'somnia-testnet',
  'soneium-minato',
  'songbird-coston',
  'sonic-blaze',
  'status-network-sepolia',
  'superseed-sepolia',
  'swellchain-testnet',
  'tac-spb',
  'tac-turin',
  'taiko-hekla',
  'taraxa-testnet',
  'telos-testnet',
  'unichain-sepolia',
  'world-chain-sepolia',
  'zephyr-testnet',
] satisfies NetworkName[];

export type Transaction = {
  gasUsed?: string;
  gas_used?: string;
  gasused?: string;
  gas: string;
  gasPrice?: string;
  gas_price: string;
  from: EthereumAddress;
  to: EthereumAddress;
} & (
  | { timestamp: string; timeStamp: never }
  | { timeStamp: string; timestamp: never }
);
