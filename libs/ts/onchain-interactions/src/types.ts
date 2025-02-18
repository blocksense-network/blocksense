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
  'horizen-gobi',
  'ink-sepolia',
  'kroma-sepolia',
  'linea-sepolia',
  'manta-sepolia',
  'mantle-sepolia',
  'morph-holesky',
  'optimism-sepolia',
  'opbnb-testnet',
  'polygon-amoy',
  'polygon-zkevm-cardona',
  'rollux-testnet',
  'scroll-sepolia',
  'songbird-coston',
  'sonic-blaze',
  'taiko-hekla',
  'telos-testnet',
  'world-chain-sepolia',
] satisfies NetworkName[];

export const API_KEYS: Record<string, string> = {
  ethereumHolesky: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  ethereumSepolia: getEnvStringNotAssert('ETHERSCAN_API_KEY'),
  arbitrumSepolia: getEnvStringNotAssert('ARBITRUM_SEPOLIA_API_KEY'),
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
  arbitrum: 'https://api.arbiscan.io/api',
  arbitrumSepolia: 'https://api-sepolia.arbiscan.io/api',
  avalanche: 'https://api.snowtrace.io/api',
  avalancheFuji: 'https://api-testnet.snowtrace.io/api',
  auroraTestnet: 'https://explorer.testnet.aurora.dev/api',
  base: 'https://api.basescan.org/api',
  baseSepolia: 'https://api-sepolia.basescan.org/api',
  berachainBartio:
    'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan',
  blastSepolia: 'https://api-sepolia.blastscan.io/api',
  bsc: 'https://api.bscscan.com/api',
  bscTestnet: 'https://api-testnet.bscscan.com/api',
  celo: 'https://api.celoscan.io/api',
  celoAlfajores: 'https://api-alfajores.celoscan.io/api',
  citreaTestnet: 'https://explorer.testnet.citrea.xyz/api',
  cronosTestnet:
    'https://explorer-api.cronos.org/testnet/api/v1/account/getTxsByAddress',
  ethereumHolesky: 'https://api-holesky.etherscan.io/api',
  ethereum: 'https://api.etherscan.io/api',
  ethereumSepolia: 'https://api-sepolia.etherscan.io/api',
  fantom: 'https://api.ftmscan.com/api',
  fantomTestnet: 'https://api-testnet.ftmscan.com/api',
  flareCoston: 'https://coston2-explorer.flare.network/api',
  inkSepolia: 'https://explorer-sepolia.inkonchain.com/api',
  harmonyTestnetShard0: 'https://explorer.testnet.harmony.one/api',
  horizenGobi: 'https://gobi-explorer-api.horizenlabs.io/api',
  kromaSepolia: 'https://blockscout.sepolia.kroma.network/api',
  linea: 'https://api.lineascan.build/api',
  lineaSepolia: 'https://api-sepolia.lineascan.build/api',
  mantaSepolia: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
  mantle: 'https://api.mantlescan.xyz/api',
  mantleSepolia: 'https://api-sepolia.mantlescan.xyz/api?',
  morphHolesky: 'https://explorer-api-holesky.morphl2.io/api/v2',
  optimism: 'https://api-optimistic.etherscan.io/api',
  optimismSepolia: 'https://api-sepolia-optimistic.etherscan.io/api',
  opbnbTestnet: 'https://opbnb-testnet.bscscan.com/api',
  polygonAmoy: 'https://api-amoy.polygonscan.com/api',
  polygonZkevmCardona: 'https://api-cardona-zkevm.polygonscan.com/api',
  rolluxTestnet: 'https://rollux.tanenbaum.io/api',
  scroll: 'https://api.scrollscan.com/api',
  scrollSepolia: 'https://api-sepolia.scrollscan.com/api',
  songbirdCoston: 'https://coston-explorer.flare.network/api',
  sonic: 'https://api.sonicscan.org/api',
  sonicBlaze: 'https://api-testnet.sonicscan.org/api',
  taikoHekla: 'https://blocmainnetn.io',
  moonriver: 'https://api-moonriver.moonscan.io/api',
  moonbeam: 'https://api-moonbeam.moonscan.io/api',
  metis: 'https://andromeda-explorer.metis.io/api',
  zksync: 'https://explorer.zksync.io/api',
  soneium: 'https://soneium.blockscout.com/api',
  soneiumMinato: 'https://soneium-minato.blockscout.com/api',
  starknet: 'https://starkscan.co/api',
  solana: 'https://explorer.solana.com/api',
  aptos: 'https://explorer.aptoslabs.com/?network=mainnet/api',
  xLayer: 'https://www.oklink.com/xlayer/api',
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
