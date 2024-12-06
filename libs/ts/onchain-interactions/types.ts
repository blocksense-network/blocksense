import { EthereumAddress } from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

export const deployedNetworks = [
  'arbitrum-sepolia',
  'avalanche-fuji',
  'base-sepolia',
  'berachain-bartio',
  'bsc-testnet',
  'celo-alfajores',
  'citrea-testnet',
  'ethereum-holesky',
  'ethereum-sepolia',
  'fantom-testnet',
  'linea-sepolia',
  'manta-sepolia',
  'morph-holesky',
  'optimism-sepolia',
  'polygon-amoy',
  'polygon-zkevm-cardona',
  'scroll-sepolia',
  'taiko-hekla',
] as const;

export const API_KEYS: Record<string, string> = {
  arbitrumSepolia: getEnvStringNotAssert('ARBITRUM_ETHERSCAN_API_KEY'),
  avalancheFuji: getEnvStringNotAssert('AVALANCHE_FUJI_ETHERSCAN_API_KEY'),
  baseSepolia: getEnvStringNotAssert('BASE_ETHERSCAN_API_KEY'),
  bscTestnet: getEnvStringNotAssert('BSC_ETHERSCAN_API_KEY'),
  celoAlfajores: getEnvStringNotAssert('CELO_ETHERSCAN_API_KEY'),
  ethereumHolesky: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  ethereumSepolia: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  fantomTestnet: getEnvStringNotAssert('FTM_ETHERSCAN_API_KEY'),
  lineaSepolia: getEnvStringNotAssert('LINEASCAN_API_KEY'),
  optimismSepolia: getEnvStringNotAssert('OPTIMISM_ETHERSCAN_API_KEY'),
  polygonAmoy: getEnvStringNotAssert('POLYGONSCAN_API_KEY'),
  polygonZkevmCardona: getEnvStringNotAssert('POLYGONSCAN_API_KEY'),
};

export const API_ENDPOINTS = {
  arbitrumSepolia: 'https://api-sepolia.arbiscan.io/api',
  avalancheFuji: 'https://api-testnet.snowtrace.io/api',
  baseSepolia: 'https://api-sepolia.basescan.org/api',
  berachainBartio:
    'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan',
  bscTestnet: 'https://api-testnet.bscscan.com/api',
  celoAlfajores: 'https://api-alfajores.celoscan.io/api',
  citreaTestnet: 'https://explorer.testnet.citrea.xyz/api',
  ethereumHolesky: 'https://api-holesky.etherscan.io/api',
  ethereumSepolia: 'https://api-sepolia.etherscan.io/api',
  fantomTestnet: 'https://api-testnet.ftmscan.com/api',
  lineaSepolia: 'https://api-sepolia.lineascan.build/api',
  mantaSepolia: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
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
};
