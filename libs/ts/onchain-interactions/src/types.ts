import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

export const deployedNetworks = [
  'arbitrum-sepolia',
  'aurora-testnet',
  'avalanche-fuji',
  'base-sepolia',
  'berachain-bartio',
  'bsc-testnet',
  'celo-alfajores',
  'citrea-testnet',
  'ethereum-holesky',
  'ethereum-sepolia',
  'fantom-testnet',
  'harmony-testnet-shard0',
  'ink-sepolia',
  'linea-sepolia',
  'manta-sepolia',
  'mantle-sepolia',
  'morph-holesky',
  'optimism-sepolia',
  'polygon-amoy',
  'polygon-zkevm-cardona',
  'scroll-sepolia',
  'taiko-hekla',
] satisfies NetworkName[];

export const API_KEYS: Record<string, string> = {
  ethereumHolesky: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  ethereumSepolia: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  arbitrumSepolia: getEnvStringNotAssert('ARBRITRUM_SEPOLIA_API_KEY'),
  baseSepolia: getEnvStringNotAssert('BASE_SEPOLIA_API_KEY'),
  blastSepolia: getEnvStringNotAssert('BLAST_SEPOLIA_API_KEY'),
  bscTestnet: getEnvStringNotAssert('BSC_TESTNET_API_KEY'),
  celoAlfajores: getEnvStringNotAssert('CELO_ALFAJORES_API_KEY'),
  fantomTestnet: getEnvStringNotAssert('FANTOM_TESTNET_API_KEY'),
  lineaSepolia: getEnvStringNotAssert('LINEA_SEPOLIA_API_KEY'),
  mantleSepolia: getEnvStringNotAssert('MANTLE_SEPOLIA_API_KEY'),
  optimismSepolia: getEnvStringNotAssert('OPTIMISM_SEPOLIA_API_KEY'),
  polygonZkevmCardona: getEnvStringNotAssert('POLYGON_ZKEVM_CARDONA_API_KEY'),
  scrollSepolia: getEnvStringNotAssert('SCROLL_SEPOLIA_API_KEY'),
};

export const API_ENDPOINTS = {
  arbitrumSepolia: 'https://api-sepolia.arbiscan.io/api',
  avalancheFuji: 'https://api-testnet.snowtrace.io/api',
  auroraTestnet: 'https://explorer.testnet.aurora.dev/api',
  baseSepolia: 'https://api-sepolia.basescan.org/api',
  berachainBartio:
    'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan',
  blastSepolia: 'https://api-sepolia.blastscan.io/api',
  bscTestnet: 'https://api-testnet.bscscan.com/api',
  celoAlfajores: 'https://api-alfajores.celoscan.io/api',
  citreaTestnet: 'https://explorer.testnet.citrea.xyz/api',
  ethereumHolesky: 'https://api-holesky.etherscan.io/api',
  ethereumSepolia: 'https://api-sepolia.etherscan.io/api',
  fantomTestnet: 'https://api-testnet.ftmscan.com/api',
  inkSepolia: 'https://explorer-sepolia.inkonchain.com/api',
  harmonyTestnetShard0: 'https://explorer.testnet.harmony.one/api',
  lineaSepolia: 'https://api-sepolia.lineascan.build/api',
  mantaSepolia: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
  mantleSepolia: 'https://api-sepolia.mantlescan.xyz/api?',
  morphHolesky: 'https://explorer-api-holesky.morphl2.io/api? ',
  optimismSepolia: 'https://api-sepolia-optimistic.etherscan.io/api',
  polygonAmoy: 'https://api-amoy.polygonscan.com/api',
  polygonZkevmCardona: 'https://api-cardona-zkevm.polygonscan.com/api',
  scrollSepolia: 'https://api-sepolia.scrollscan.com/api',
  taikoHekla: 'https://blockscoutapi.hekla.taiko.xyz/api',
};

export type Transaction = {
  gasUsed: string;
  gasPrice: string;
  from: EthereumAddress;
  to: EthereumAddress;
  timeStamp?: string;
};
