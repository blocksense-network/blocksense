import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { getEnvStringNotAssert } from '@blocksense/base-utils/env';

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
  'hemi-sepolia',
  'horizen-gobi',
  'inevm-testnet',
  'ink-sepolia',
  'kroma-sepolia',
  'linea-sepolia',
  'manta-sepolia',
  'mantle-sepolia',
  'mezo-matsnet-testnet',
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

export const API_KEYS: Record<string, string> = {
  ethereumHolesky: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  ethereumSepolia: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  arbitrumSepolia: getEnvStringNotAssert('ARBRITRUM_SEPOLIA_API_KEY'),
  baseSepolia: getEnvStringNotAssert('BASE_SEPOLIA_API_KEY'),
  blastSepolia: getEnvStringNotAssert('BLAST_SEPOLIA_API_KEY'),
  bscTestnet: getEnvStringNotAssert('BSC_TESTNET_API_KEY'),
  celoAlfajores: getEnvStringNotAssert('CELO_ALFAJORES_API_KEY'),
  cronosTestnet: getEnvStringNotAssert('CRONOS_TESTNET_API_KEY'),
  fantomTestnet: getEnvStringNotAssert('FANTOM_TESTNET_API_KEY'),
  lineaSepolia: getEnvStringNotAssert('LINEA_SEPOLIA_API_KEY'),
  mantleSepolia: getEnvStringNotAssert('MANTLE_SEPOLIA_API_KEY'),
  optimismSepolia: getEnvStringNotAssert('OPTIMISM_SEPOLIA_API_KEY'),
  polygonZkevmCardona: getEnvStringNotAssert('POLYGON_ZKEVM_CARDONA_API_KEY'),
  scrollSepolia: getEnvStringNotAssert('SCROLL_SEPOLIA_API_KEY'),
  sonicBlaze: getEnvStringNotAssert('SONIC_BLAZE_API_KEY'),
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
  cronosTestnet:
    'https://explorer-api.cronos.org/testnet/api/v1/account/getTxsByAddress',
  ethereumHolesky: 'https://api-holesky.etherscan.io/api',
  ethereumSepolia: 'https://api-sepolia.etherscan.io/api',
  fantomTestnet: 'https://api-testnet.ftmscan.com/api',
  flareCoston: 'https://coston2-explorer.flare.network/api',
  inevmTestnet: 'https://testnet.explorer.inevm.com/api',
  inkSepolia: 'https://explorer-sepolia.inkonchain.com/api',
  harmonyTestnetShard0: 'https://explorer.testnet.harmony.one/api',
  hemiSepolia: 'https://testnet.explorer.hemi.xyz/api',
  horizenGobi: 'https://gobi-explorer-api.horizenlabs.io/api',
  kromaSepolia: 'https://blockscout.sepolia.kroma.network/api',
  lineaSepolia: 'https://api-sepolia.lineascan.build/api',
  mantaSepolia: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
  mezoMatsnetTestnet: 'https://explorer.test.mezo.org/api',
  mantleSepolia: 'https://api-sepolia.mantlescan.xyz/api?',
  morphHolesky: 'https://explorer-api-holesky.morphl2.io/api/v2',
  optimismSepolia: 'https://api-sepolia-optimistic.etherscan.io/api',
  opbnbTestnet: 'https://opbnb-testnet.bscscan.com/api',
  polygonAmoy: 'https://api-amoy.polygonscan.com/api',
  polygonZkevmCardona: 'https://api-cardona-zkevm.polygonscan.com/api',
  rolluxTestnet: 'https://rollux.tanenbaum.io/api',
  scrollSepolia: 'https://api-sepolia.scrollscan.com/api',
  shapeSepolia: 'https://explorer-sepolia.shape.network/api',
  songbirdCoston: 'https://coston-explorer.flare.network/api',
  sonicBlaze: 'https://api-testnet.sonicscan.org/api',
  taikoHekla: 'https://blockscoutapi.hekla.taiko.xyz/api',
  telosTestnet: 'https://api.teloscan.io/v1',
  worldChainSepolia: 'https://worldchain-sepolia.explorer.alchemy.com/api',
};

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
