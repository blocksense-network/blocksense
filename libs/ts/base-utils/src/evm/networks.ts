/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Schema as S } from 'effect';

import { getEnvString, getOptionalEnvString } from '../env/functions';
import { EthereumAddress, TxHash } from './hex-types';
import {
  KebabToScreamingSnakeCase,
  kebabToScreamingSnakeCase,
} from '../string';
import { NumberFromSelfBigIntOrString } from '../schemas';

const networks = [
  'local',
  'ethereum-mainnet',
  'ethereum-sepolia',
  'ethereum-holesky',
  'abstract-testnet',
  'arbitrum-mainnet',
  'arbitrum-sepolia',
  'aurora-testnet',
  'avalanche-mainnet',
  'avalanche-fuji',
  'base-mainnet',
  'base-sepolia',
  'basecamp-testnet',
  'berachain-mainnet',
  'berachain-bepolia',
  'bitlayer-mainnet',
  'bitlayer-testnet',
  'blast-mainnet',
  'blast-sepolia',
  'boba-bnb-mainnet',
  'boba-bnb-testnet',
  'boba-mainnet',
  'boba-sepolia',
  'bsc-mainnet',
  'bsc-testnet',
  'camp-network-testnet-v2',
  'celo-mainnet',
  'celo-alfajores',
  'citrea-testnet',
  'creator-chain-testnet',
  'cronos-testnet',
  'cyber-testnet',
  'expchain-testnet',
  'exSat-testnet',
  'fantom-mainnet',
  'fantom-testnet',
  'flare-coston',
  'fraxtal-mainnet',
  'fraxtal-testnet',
  'gameswift-chain-testnet',
  'gnosis-mainnet',
  'gnosis-chiado',
  'harmony-testnet-shard0',
  'hemi-sepolia',
  'hoodi-testnet',
  'horizen-gobi',
  'hyperliquid-evm-testnet',
  'inevm-testnet',
  'ink-mainnet',
  'ink-sepolia',
  'kava-testnet',
  'kusama-moonbeam',
  'kusama-moonbase-alpha',
  'kusama-moonriver',
  'linea-mainnet',
  'linea-sepolia',
  'lisk-sepolia',
  'lumia-mainnet',
  'lumia-beam-testnet',
  'manta-mainnet',
  'manta-sepolia',
  'mantle-mainnet',
  'mantle-sepolia',
  'metal-l2-testnet',
  'metis-andromeda-mainnet',
  'metis-sepolia',
  'megaeth-testnet',
  'mezo-matsnet-testnet',
  'monad-testnet',
  'morph-mainnet',
  'morph-holesky',
  'nexera-testnet',
  'okto-testnet',
  'ontology-testnet',
  'optimism-mainnet',
  'optimism-sepolia',
  'opbnb-testnet',
  'ozean-poseidon-testnet',
  'pharos-testnet',
  'plasma-testnet',
  'plume-mainnet',
  'plume-testnet',
  'polygon-mainnet',
  'polygon-amoy',
  'polygon-zkevm-mainnet',
  'polygon-zkevm-cardona',
  'pyrope-testnet',
  'rise-testnet',
  'rollux-testnet',
  'rome-testnet',
  'rootstock-testnet',
  'scroll-mainnet',
  'scroll-sepolia',
  'shape-sepolia',
  'somnia-mainnet',
  'somnia-testnet',
  'soneium-mainnet',
  'soneium-minato',
  'songbird-coston',
  'sonic-mainnet',
  'sonic-blaze',
  'status-network-sepolia',
  'superseed-mainnet',
  'superseed-sepolia',
  'swellchain-testnet',
  'tac-mainnet',
  'tac-spb',
  'tac-turin',
  'taiko-mainnet',
  'taiko-hekla',
  'tanssi-demo',
  'taraxa-testnet',
  'telos-testnet',
  'unichain-mainnet',
  'unichain-sepolia',
  'world-chain-sepolia',
  'zephyr-testnet',
  'zksync-mainnet',
  'zksync-sepolia',
] as const;

const chainIds = [
  99999999999, 1, 11155111, 17000, 11124, 1088, 42161, 421614, 1313161555,
  43114, 43113, 123420001114, 8453, 84532, 80094, 80069, 200901, 200810, 81457,
  168587773, 56288, 9728, 288, 28882, 56, 97, 325000, 42220, 44787, 5115, 66665,
  338, 111557560, 18880, 839999, 250, 4002, 114, 252, 2522, 10888, 100, 10200,
  1666700000, 743111, 560048, 1663, 998, 2424, 57073, 763373, 2221, 1284, 1287,
  1285, 59144, 59141, 4202, 994873017, 2030232745, 169, 3441006, 5000, 5003,
  1740, 59902, 6342, 31611, 10143, 2818, 2810, 72080, 8801, 5851, 10, 11155420,
  5611, 7849306, 688688, 9746, 98866, 98867, 137, 80002, 1101, 2442, 695569,
  11155931, 57000, 200018, 31, 534352, 534351, 11011, 5031, 50312, 1868, 1946,
  16, 146, 57054, 1660990954, 5330, 53302, 1924, 239, 2391, 2390, 167000,
  167009, 5678, 842, 41, 130, 1301, 4801, 1417429182, 324, 300,
] as const;

export const networkName = S.Literal(...networks).annotations({
  identifier: 'NetworkName',
});
export const isNetworkName = S.is(networkName);
export const parseNetworkName = S.decodeUnknownSync(networkName);
export type NetworkName = typeof networkName.Type;

export const chainId = S.compose(
  NumberFromSelfBigIntOrString,
  S.Literal(...chainIds).annotations({ identifier: 'ChainId' }),
);
export const isChainId = S.is(chainId);
export const parseChainId = S.decodeUnknownSync(chainId);
export type ChainId = typeof chainId.Type;

export const network = S.Union(networkName, chainId);
export const isNetwork = S.is(network);
export const parseNetwork = S.decodeUnknownSync(network);
export type Network = typeof network.Type;

export const networkKindSchema = S.Literal(
  'local',
  'testnet',
  'mainnet',
).annotations({ identifier: 'NetworkKind' });
export type NetworkKind = typeof networkKindSchema.Type;

export type NetworkNameToKind<N extends NetworkName> = N extends 'local'
  ? 'local'
  : (typeof networkMetadata)[N]['isTestnet'] extends true
    ? 'testnet'
    : 'mainnet';

export function getNetworkKind<N extends NetworkName>(
  network: N,
): NetworkNameToKind<N> {
  if (network === 'local') return 'local' as any;
  if (isTestnet(network)) return 'testnet' as any;
  return 'mainnet' as any;
}

export enum Currency {
  ETH = 'ETH',
  AVAX = 'AVAX',
  BERA = 'BERA',
  BNB = 'BNB',
  BTC = 'BTC',
  C2FLR = 'C2FLR',
  CAMP = 'CAMP',
  cBTC = 'cBTC',
  CELO = 'CELO',
  CETH = 'CETH',
  CFLR = 'CFLR',
  DEV = 'DEV',
  frxETH = 'frxETH',
  FTM = 'FTM',
  GLMR = 'GLMR',
  HYPE = 'HYPE',
  INJ = 'INJ',
  KAVA = 'KAVA',
  LUMIA = 'LUMIA',
  MATIC = 'MATIC',
  METIS = 'METIS',
  MNT = 'MNT',
  MON = 'MON',
  MOVR = 'MOVR',
  OKTO = 'OKTO',
  ONE = 'ONE',
  ONG = 'ONG',
  PHRS = 'PHRS',
  PLUME = 'PLUME',
  POL = 'POL',
  ROME = 'ROME',
  S = 'S',
  STT = 'STT',
  sMETIS = 'sMETIS',
  TAC = 'TAC',
  TANGO = 'TANGO',
  TARA = 'TARA',
  tBNB = 'tBNB',
  TCRO = 'TCRO',
  tFTM = 'tFTM',
  tGS = 'tGS',
  TLOS = 'TLOS',
  tNXRA = 'tNXRA',
  tRBTC = 'tRBTC',
  TSYS = 'TSYS',
  tZEN = 'tZEN',
  tZKJ = 'tZKJ',
  USDX = 'USDX',
  xDAI = 'xDAI',
  XPL = 'XPL',
  Z = 'Z',
}

/**
 * Mapping of network names to explorer URLs
 * The URL generator functions take a transaction hash or an address as input and return the corresponding explorer URL.
 */
export const networkMetadata = {
  local: {
    chainId: 99999999999,
    isTestnet: false,
    explorers: [
      {
        type: 'unknown',
        webUrl: '',
        apiUrl: null,
      },
    ],
    currency: Currency.ETH,
  },
  'ethereum-mainnet': {
    chainId: 1,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://etherscan.io',
        apiUrl: 'https://api.etherscan.io/api',
      },
      {
        type: 'blockscout',
        webUrl: 'https://eth.blockscout.com',
        apiUrl: 'https://eth.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.etherscan.io',
        apiUrl: 'https://api-sepolia.etherscan.io/api',
      },
      {
        type: 'blockscout',
        webUrl: 'https://eth-sepolia.blockscout.com',
        apiUrl: 'https://eth-sepolia.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'ethereum-holesky': {
    chainId: 17000,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://holesky.etherscan.io',
        apiUrl: 'https://api-holesky.etherscan.io/api',
      },
      {
        type: 'blockscout',
        webUrl: 'https://eth-holesky.blockscout.com',
        apiUrl: 'https://eth-holesky.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'abstract-testnet': {
    chainId: 11124,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.abscan.org',
        apiUrl: 'https://api-sepolia.abscan.org/api',
      },
    ],
    currency: Currency.ETH,
  },
  'arbitrum-mainnet': {
    chainId: 42161,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://arbitrum.blockscout.com',
        apiUrl: 'https://arbitrum.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://arbitrum-sepolia.blockscout.com',
        apiUrl: 'https://arbitrum-sepolia.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://arbiscan.io/',
        apiUrl: 'https://api-sepolia.arbiscan.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'aurora-testnet': {
    chainId: 1313161555,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.testnet.aurora.dev',
        apiUrl: 'https://explorer.testnet.aurora.dev/api',
      },
    ],
    currency: Currency.ETH,
  },
  'avalanche-mainnet': {
    chainId: 43114,
    isTestnet: false,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://snowtrace.io',
        apiUrl:
          'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
      },
      {
        type: 'etherscan',
        webUrl: 'https://snowscan.xyz',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=43114',
      },
    ],
    currency: Currency.AVAX,
  },
  'avalanche-fuji': {
    chainId: 43113,
    isTestnet: true,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://subnets-test.avax.network/c-chain',
        apiUrl:
          'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan',
      },
      {
        type: 'etherscan',
        webUrl: 'https://testnet.snowscan.xyz',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=43113',
      },
    ],
    currency: Currency.AVAX,
  },
  'base-mainnet': {
    chainId: 8453,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://base.blockscout.com',
        apiUrl: 'https://base.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://basescan.org/',
        apiUrl: 'https://api.basescan.org/api',
      },
    ],
    currency: Currency.ETH,
  },
  'base-sepolia': {
    chainId: 84532,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.basescan.org/',
        apiUrl: 'https://api-sepolia.basescan.org/api',
      },
      {
        type: 'blockscout',
        webUrl: 'https://base-sepolia.blockscout.com',
        apiUrl: 'https://base-sepolia.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'basecamp-testnet': {
    chainId: 123420001114,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://basecamp.cloud.blockscout.com',
        apiUrl: 'https://basecamp.cloud.blockscout.com/api',
      },
    ],
    currency: Currency.CAMP,
  },
  'berachain-mainnet': {
    chainId: 80094,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://berascan.com',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=80094',
      },
    ],
    currency: Currency.BERA,
  },
  'berachain-bepolia': {
    chainId: 80069,
    isTestnet: true,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://bepolia.beratrail.io',
        apiUrl:
          'https://api.routescan.io/v2/network/testnet/evm/80069/etherscan',
      },
      {
        type: 'etherscan',
        webUrl: 'https://testnet.berascan.com',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=80069',
      },
    ],
    currency: Currency.BERA,
  },
  'bitlayer-mainnet': {
    chainId: 200901,
    isTestnet: false,
    explorers: [
      {
        type: 'bitlayer',
        webUrl: 'https://btrscan.com',
        apiUrl: 'https://api.btrscan.com/scan/api',
      },
    ],
    currency: Currency.BTC,
  },
  'bitlayer-testnet': {
    chainId: 200810,
    isTestnet: true,
    explorers: [
      {
        type: 'bitlayer',
        webUrl: 'https://testnet-scan.bitlayer.org',
        apiUrl: 'https://api-testnet.bitlayer.org/scan/api',
      },
    ],
    currency: Currency.BTC,
  },
  'blast-mainnet': {
    chainId: 81457,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer-testnet.unit0.dev',
        apiUrl: 'https://explorer-testnet.unit0.dev/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://blastscan.io',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=81457',
      },
    ],
    currency: Currency.ETH,
  },
  'blast-sepolia': {
    chainId: 168587773,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.blastscan.io',
        apiUrl: 'https://api-sepolia.blastscan.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'boba-bnb-mainnet': {
    chainId: 56288,
    isTestnet: false,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://bnb.bobascan.com',
        apiUrl:
          'https://api.routescan.io/v2/network/mainnet/evm/56288/etherscan',
      },
    ],
    currency: Currency.ETH,
  },
  'boba-bnb-testnet': {
    chainId: 9728,
    isTestnet: true,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://bnb.testnet.bobascan.com',
        apiUrl:
          'https://api.routescan.io/v2/network/testnet/evm/9728/etherscan',
      },
    ],
    currency: Currency.ETH,
  },
  'boba-mainnet': {
    chainId: 288,
    isTestnet: false,
    currency: Currency.ETH,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://bobascan.com',
        apiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/288/etherscan',
      },
    ],
  },
  'boba-sepolia': {
    chainId: 28882,
    isTestnet: true,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://sepolia.testnet.bobascan.com',
        apiUrl:
          'https://api.routescan.io/v2/network/testnet/evm/28882/etherscan',
      },
    ],
    currency: Currency.ETH,
  },
  'bsc-mainnet': {
    chainId: 56,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://bscscan.com',
        apiUrl: 'https://api.bscscan.com/api',
      },
    ],
    currency: Currency.BNB,
  },
  'bsc-testnet': {
    chainId: 97,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://testnet.bscscan.com',
        apiUrl: 'https://api-testnet.bscscan.com/api',
      },
    ],
    currency: Currency.tBNB,
  },
  'camp-network-testnet-v2': {
    chainId: 325000,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://camp-network-testnet.blockscout.com',
        apiUrl: null,
      },
    ],
    currency: Currency.ETH,
  },
  'celo-mainnet': {
    chainId: 42220,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://celo.blockscout.com',
        apiUrl: 'https://celo.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://celoscan.io',
        apiUrl: 'https://api.celoscan.io/api',
      },
    ],
    currency: Currency.CELO,
  },
  'celo-alfajores': {
    chainId: 44787,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://celo-alfajores.blockscout.com',
        apiUrl: 'https://celo-alfajores.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://alfajores.celoscan.io',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=44787',
      },
    ],
    currency: Currency.CELO,
  },
  'citrea-testnet': {
    chainId: 5115,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.testnet.citrea.xyz',
        apiUrl: 'https://explorer.testnet.citrea.xyz/api',
      },
    ],
    currency: Currency.cBTC,
  },
  'creator-chain-testnet': {
    chainId: 66665,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.creatorchain.io',
        apiUrl: 'https://explorer.creatorchain.io/api',
      },
    ],
    currency: Currency.CETH,
  },
  'cronos-testnet': {
    chainId: 338,
    isTestnet: true,
    explorers: [
      {
        type: 'cronos',
        webUrl: 'https://explorer.cronos.org/testnet',
        apiUrl: 'https://explorer-api.cronos.org/testnet/api/v1',
      },
    ],
    currency: Currency.TCRO,
  },
  'cyber-testnet': {
    chainId: 111557560,
    isTestnet: true,
    explorers: [
      {
        type: 'socialscan',
        webUrl: 'https://cyber-testnet.socialscan.io',
        apiUrl: 'https://api.socialscan.io/cyber-testnet/v1',
      },
    ],
    currency: Currency.ETH,
  },
  'expchain-testnet': {
    chainId: 18880,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://blockscout-testnet.expchain.ai',
        apiUrl: 'https://blockscout-testnet.gadsgcxobnadfogadsihg.com/api/v2',
      },
    ],
    currency: Currency.tZKJ,
  },
  'exSat-testnet': {
    chainId: 839999,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://scan-testnet.exsat.network',
        apiUrl: 'https://scan-testnet.exsat.network/api',
      },
    ],
    currency: Currency.BTC,
  },
  'fantom-mainnet': {
    chainId: 250,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://ftmscan.com',
        apiUrl: 'https://ftmscout.com/api',
      },
    ],
    currency: Currency.FTM,
  },
  'fantom-testnet': {
    chainId: 4002,
    isTestnet: true,
    explorers: [
      {
        type: 'unknown',
        webUrl: 'https://explorer.testnet.fantom.network',
        apiUrl: 'https://xapi.testnet.fantom.network/api',
      },
    ],
    currency: Currency.tFTM,
  },
  'flare-coston': {
    chainId: 114,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://coston2-explorer.flare.network',
        apiUrl: 'https://coston2-explorer.flare.network/api',
      },
    ],
    currency: Currency.C2FLR,
  },
  'fraxtal-mainnet': {
    chainId: 252,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://fraxscan.com',
        apiUrl: 'https://api.fraxscan.com/api',
      },
    ],
    currency: Currency.frxETH,
  },
  'fraxtal-testnet': {
    chainId: 2522,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://holesky.fraxscan.com',
        apiUrl: 'https://api-holesky.fraxscan.com/api',
      },
    ],
    currency: Currency.frxETH,
  },
  'gameswift-chain-testnet': {
    chainId: 10888,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet.gameswift.io',
        apiUrl: 'https://testnet.gameswift.io/api',
      },
    ],
    currency: Currency.tGS,
  },
  'gnosis-mainnet': {
    chainId: 100,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://gnosisscan.io',
        apiUrl: 'https://api.gnosisscan.io/api',
      },
    ],
    currency: Currency.xDAI,
  },
  'gnosis-chiado': {
    chainId: 10200,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://gnosis-chiado.blockscout.com',
        apiUrl: 'https://gnosis-chiado.blockscout.com/api',
      },
    ],
    currency: Currency.xDAI,
  },
  'harmony-testnet-shard0': {
    chainId: 1666700000,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.testnet.harmony.one',
        apiUrl: 'https://explorer.testnet.harmony.one/api',
      },
    ],
    currency: Currency.ONE,
  },
  'hemi-sepolia': {
    chainId: 743111,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet.explorer.hemi.xyz',
        apiUrl: 'https://testnet.explorer.hemi.xyz/api',
      },
    ],
    currency: Currency.ETH,
  },
  'hoodi-testnet': {
    chainId: 560048,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://eth-hoodi.blockscout.com',
        apiUrl: 'https://eth-hoodi.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://hoodi.etherscan.io',
        apiUrl: 'https://api-hoodi.etherscan.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'horizen-gobi': {
    chainId: 1663,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://gobi-explorer.horizenlabs.io',
        apiUrl: 'https://gobi-explorer-api.horizenlabs.io/api',
      },
    ],
    currency: Currency.tZEN,
  },
  'hyperliquid-evm-testnet': {
    chainId: 998,
    isTestnet: true,
    explorers: [
      {
        type: 'unknown',
        webUrl: 'https://testnet.purrsec.com',
        apiUrl: 'https://api.parsec.finance/api',
      },
    ],
    currency: Currency.HYPE,
  },
  'inevm-testnet': {
    chainId: 2424,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet.explorer.inevm.com',
        apiUrl: 'https://testnet.explorer.inevm.com/api',
      },
    ],
    currency: Currency.INJ,
  },
  'ink-mainnet': {
    chainId: 57073,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.inkonchain.com',
        apiUrl: 'https://explorer.inkonchain.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'ink-sepolia': {
    chainId: 763373,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer-sepolia.inkonchain.com',
        apiUrl: 'https://explorer-sepolia.inkonchain.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'kava-testnet': {
    chainId: 2221,
    isTestnet: true,
    explorers: [
      {
        type: 'kava',
        webUrl: 'https://testnet.kavascan.com/',
        apiUrl: 'https://api.verify.mintscan.io/evm/api/0x8ad',
      },
    ],
    currency: Currency.KAVA,
  },
  'kusama-moonbeam': {
    chainId: 1284,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://moonbeam.moonscan.io',
        apiUrl: 'https://api-moonbeam.moonscan.io/api',
      },
    ],
    currency: Currency.GLMR,
  },
  'kusama-moonbase-alpha': {
    chainId: 1287,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://moonbase.moonscan.io',
        apiUrl: 'https://api-moonbase.moonscan.io/api',
      },
    ],
    currency: Currency.DEV,
  },
  'kusama-moonriver': {
    chainId: 1285,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://moonriver.moonscan.io',
        apiUrl: 'https://api-moonriver.moonscan.io/api',
      },
    ],
    currency: Currency.MOVR,
  },
  'linea-mainnet': {
    chainId: 59144,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.linea.build/',
        apiUrl: 'https://api-explorer.linea.build/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://lineascan.build',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=59144',
      },
    ],
    currency: Currency.ETH,
  },
  'linea-sepolia': {
    chainId: 59141,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.sepolia.linea.build',
        apiUrl: 'https://api-explorer.sepolia.linea.build/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.lineascan.build',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=59141',
      },
    ],
    currency: Currency.ETH,
  },
  'lisk-sepolia': {
    chainId: 4202,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://sepolia-blockscout.lisk.com',
        apiUrl: 'https://sepolia-blockscout.lisk.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'lumia-mainnet': {
    chainId: 994873017,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.lumia.org',
        apiUrl: 'https://explorer.lumia.org/api',
      },
    ],
    currency: Currency.LUMIA,
  },
  'lumia-beam-testnet': {
    chainId: 2030232745,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://beam-explorer.lumia.org',
        apiUrl: 'https://beam-explorer.lumia.org/api',
      },
    ],
    currency: Currency.LUMIA,
  },
  'manta-mainnet': {
    chainId: 169,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://pacific-explorer.manta.network',
        apiUrl: 'https://pacific-explorer.manta.network/api',
      },
    ],
    currency: Currency.ETH,
  },
  'manta-sepolia': {
    chainId: 3441006,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://pacific-explorer.sepolia-testnet.manta.network',
        apiUrl: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
      },
    ],
    currency: Currency.ETH,
  },
  'mantle-mainnet': {
    chainId: 5000,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://mantlescan.xyz',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=5000',
      },
    ],
    currency: Currency.MNT,
  },
  'mantle-sepolia': {
    chainId: 5003,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.mantlescan.xyz',
        apiUrl: 'https://api-sepolia.mantlescan.xyz/api',
      },
      {
        type: 'blockscout',
        webUrl: 'https://explorer.sepolia.mantle.xyz',
        apiUrl: 'https://explorer.sepolia.mantle.xyz/api',
      },
    ],
    currency: Currency.MNT,
  },
  'metal-l2-testnet': {
    chainId: 1740,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet.explorer.metall2.com',
        apiUrl: 'https://testnet.explorer.metall2.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'metis-andromeda-mainnet': {
    chainId: 1088,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://andromeda-explorer.metis.io',
        apiUrl: 'https://andromeda-explorer.metis.io/api',
      },
    ],
    currency: Currency.METIS,
  },
  'metis-sepolia': {
    chainId: 59902,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://sepolia-explorer.metisdevops.link',
        apiUrl: 'https://sepolia-explorer-api.metisdevops.link/api/v2',
      },
    ],
    currency: Currency.sMETIS,
  },
  'megaeth-testnet': {
    chainId: 6342,
    isTestnet: true,
    explorers: [
      {
        type: 'megaeth',
        webUrl: 'https://megaexplorer.xyz',
        apiUrl: 'https://megaexplorer.xyz/api',
      },
    ],
    currency: Currency.ETH,
  },
  'mezo-matsnet-testnet': {
    chainId: 31611,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.test.mezo.org',
        apiUrl: 'https://api.explorer.test.mezo.org/api/v2/',
      },
    ],
    currency: Currency.BTC,
  },
  'monad-testnet': {
    chainId: 10143,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://testnet.monadscan.com',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=10143',
      },
    ],
    currency: Currency.MON,
  },
  'morph-mainnet': {
    chainId: 2818,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.morphl2.io',
        apiUrl: 'https://explorer-api.morphl2.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'morph-holesky': {
    chainId: 2810,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer-holesky.morphl2.io',
        apiUrl: 'https://explorer-holesky.morphl2.io/api', //to do
      },
    ],
    currency: Currency.ETH,
  },
  'nexera-testnet': {
    chainId: 72080,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.testnet.nexera.network',
        apiUrl: 'https://explorer.testnet.nexera.network/api',
      },
    ],
    currency: Currency.tNXRA,
  },
  'okto-testnet': {
    chainId: 8801,
    isTestnet: true,
    explorers: [
      {
        type: 'unknown',
        webUrl: 'https://testnet.okto.tech',
        apiUrl: 'https://sandbox-api.okto.tech',
      },
    ],
    currency: Currency.OKTO,
  },
  'ontology-testnet': {
    chainId: 5851,
    isTestnet: true,
    explorers: [
      {
        type: 'ontology',
        webUrl: 'https://explorer.ont.io/testnet',
        apiUrl: 'https://explorer.ont.io/testnet/api',
      },
    ],
    currency: Currency.ONG,
  },
  'optimism-mainnet': {
    chainId: 10,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://optimism.blockscout.com/',
        apiUrl: 'https://optimism.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://optimistic.etherscan.io',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=10',
      },
    ],
    currency: Currency.ETH,
  },
  'optimism-sepolia': {
    chainId: 11155420,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sepolia-optimism.etherscan.io',
        apiUrl: 'https://api-sepolia-optimistic.etherscan.io/api',
      },
      {
        type: 'blockscout', //test again
        webUrl: 'https://optimism-sepolia.blockscout.com',
        apiUrl: 'https://optimism-sepolia.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'opbnb-testnet': {
    chainId: 5611,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://opbnb-testnet.bscscan.com',
        apiUrl: 'https://api-opbnb-testnet.bscscan.com/api',
      },
    ],
    currency: Currency.tBNB,
  },
  'ozean-poseidon-testnet': {
    chainId: 7849306,
    isTestnet: true,
    explorers: [
      {
        type: 'unknown',
        webUrl: 'https://ozean-testnet.explorer.caldera.xyz',
        apiUrl: 'https://poseidon-testnet.explorer.caldera.xyz/api/v2',
      },
    ],
    currency: Currency.USDX,
  },
  'pharos-testnet': {
    chainId: 688688,
    isTestnet: true,
    explorers: [
      {
        type: 'unknown',
        webUrl: 'https://testnet.pharosscan.xyz',
        apiUrl: 'https://api.socialscan.io/pharos-testnet', //
      },
    ],
    currency: Currency.PHRS,
  },
  'plasma-testnet': {
    chainId: 9746,
    isTestnet: true,
    explorers: [
      {
        type: 'routescan',
        webUrl: 'https://testnet.plasmascan.to',
        apiUrl:
          'https://api.routescan.io/v2/network/testnet/evm/9746/etherscan',
      },
    ],
    currency: Currency.XPL,
  },
  'plume-mainnet': {
    chainId: 98866,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://phoenix-explorer.plumenetwork.xyz',
        apiUrl: 'https://phoenix-explorer.plumenetwork.xyz/api',
      },
    ],
    currency: Currency.PLUME,
  },
  'plume-testnet': {
    chainId: 98867,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet-explorer.plumenetwork.xyz',
        apiUrl: 'https://testnet-explorer.plumenetwork.xyz/api',
      },
    ],
    currency: Currency.PLUME,
  },
  'polygon-mainnet': {
    chainId: 137,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://polygonscan.com',
        apiUrl: 'https://api.polygonscan.com/api',
      },
    ],
    currency: Currency.MATIC,
  },
  'polygon-amoy': {
    chainId: 80002,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://amoy.polygonscan.com',
        apiUrl: 'https://api-amoy.polygonscan.com/api',
      },
    ],
    currency: Currency.POL,
  },
  'polygon-zkevm-mainnet': {
    chainId: 1101,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://zkevm.polygonscan.com',
        apiUrl: 'https://api-zkevm.polygonscan.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'polygon-zkevm-cardona': {
    chainId: 2442,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://cardona-zkevm.polygonscan.com',
        apiUrl: 'https://api-cardona-zkevm.polygonscan.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'pyrope-testnet': {
    chainId: 695569,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.pyropechain.com',
        apiUrl: 'https://explorer.pyropechain.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'rise-testnet': {
    chainId: 11155931,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.testnet.riselabs.xyz',
        apiUrl: 'https://explorer.testnet.riselabs.xyz/api',
      },
    ],
    currency: Currency.ETH,
  },
  'rollux-testnet': {
    chainId: 57000,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://rollux.tanenbaum.io',
        apiUrl: 'https://rollux.tanenbaum.io/api',
      },
    ],
    currency: Currency.TSYS,
  },
  'rome-testnet': {
    chainId: 200018,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://rome.testnet.romeprotocol.xyz:1000',
        apiUrl: 'https://rome.testnet.romeprotocol.xyz:1000/api',
      },
    ],
    currency: Currency.ROME,
  },
  'rootstock-testnet': {
    chainId: 31,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://rootstock-testnet.blockscout.com/',
        apiUrl: 'https://rootstock-testnet.blockscout.com/api',
      },
    ],
    currency: Currency.tRBTC,
  },
  'scroll-mainnet': {
    chainId: 534352,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://scroll.blockscout.com',
        apiUrl: 'https://scroll.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://scrollscan.com',
        apiUrl: 'https://api.scrollscan.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'scroll-sepolia': {
    chainId: 534351,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://scroll-sepolia.blockscout.com',
        apiUrl: 'https://scroll-sepolia.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.scrollscan.com',
        apiUrl: 'https://api-sepolia.scrollscan.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'shape-sepolia': {
    chainId: 11011,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer-sepolia.shape.network',
        apiUrl: 'https://explorer-sepolia.shape.network/api',
      },
    ],
    currency: Currency.ETH,
  },
  'somnia-mainnet': {
    chainId: 5031,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://mainnet.somnia.w3us.site',
        apiUrl: 'https://mainnet.somnia.w3us.site/api',
      },
    ],
    currency: Currency.STT,
  },
  'somnia-testnet': {
    chainId: 50312,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://shannon-explorer.somnia.network/',
        apiUrl: 'https://shannon-explorer.somnia.network/api',
      },
    ],
    currency: Currency.STT,
  },
  'soneium-mainnet': {
    chainId: 1868,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://soneium.blockscout.com',
        apiUrl: 'https://soneium.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'soneium-minato': {
    chainId: 1946,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://soneium-minato.blockscout.com',
        apiUrl: 'https://soneium-minato.blockscout.com/api',
      },
    ],
    currency: Currency.ETH,
  },
  'songbird-coston': {
    chainId: 16,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://coston-explorer.flare.network',
        apiUrl: 'https://coston-explorer.flare.network/api',
      },
    ],
    currency: Currency.CFLR,
  },
  'sonic-mainnet': {
    chainId: 146,
    isTestnet: false,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://sonicscan.org',
        apiUrl: 'https://api.sonicscan.org/api',
      },
    ],
    currency: Currency.S,
  },
  'sonic-blaze': {
    chainId: 57054,
    isTestnet: true,
    explorers: [
      {
        type: 'etherscan',
        webUrl: 'https://testnet.sonicscan.org',
        apiUrl: 'https://api-testnet.sonicscan.org/api',
      },
    ],
    currency: Currency.S,
  },
  'status-network-sepolia': {
    chainId: 1660990954,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://sepoliascan.status.network',
        apiUrl: 'https://sepoliascan.status.network/api',
      },
    ],
    currency: Currency.ETH,
  },
  'superseed-mainnet': {
    chainId: 5330,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.superseed.xyz',
        apiUrl: 'https://explorer.superseed.xyz/api',
      },
    ],
    currency: Currency.ETH,
  },
  'superseed-sepolia': {
    chainId: 53302,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://sepolia-explorer.superseed.xyz',
        apiUrl: 'https://sepolia-explorer.superseed.xyz/api',
      },
    ],
    currency: Currency.ETH,
  },
  'swellchain-testnet': {
    chainId: 1924,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://swell-testnet-explorer.alt.technology',
        apiUrl: 'https://swell-testnet-explorer.alt.technology/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.swellchainscan.io',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=1924',
      },
    ],
    currency: Currency.ETH,
  },
  'tac-mainnet': {
    chainId: 239,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.tac.build',
        apiUrl: 'https://explorer.tac.build/api',
      },
    ],
    currency: Currency.TAC,
  },
  'tac-spb': {
    chainId: 2391,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://spb.explorer.tac.build',
        apiUrl: 'https://spb.explorer.tac.build/api',
      },
    ],
    currency: Currency.TAC,
  },
  'tac-turin': {
    chainId: 2390,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://turin.explorer.tac.build',
        apiUrl: 'https://turin.explorer.tac.build/api',
      },
    ],
    currency: Currency.TAC,
  },
  'taiko-mainnet': {
    chainId: 167000,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://blockscout.mainnet.taiko.xyz',
        apiUrl: 'https://blockscoutapi.mainnet.taiko.xyz/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://taikoscan.io',
        apiUrl: 'https://api.taikoscan.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'taiko-hekla': {
    chainId: 167009,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://explorer.hekla.taiko.xyz',
        apiUrl: 'https://blockscoutapi.hekla.taiko.xyz/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://hekla.taikoscan.io',
        apiUrl: 'https://api-hekla.taikoscan.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'tanssi-demo': {
    chainId: 5678,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://dancelight-2001-blockscout.tanssi-chains.network',
        apiUrl: 'https://dancelight-2001-blockscout.tanssi-chains.network/api',
      },
    ],
    currency: Currency.TANGO,
  },
  'taraxa-testnet': {
    chainId: 842,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://testnet.to',
        apiUrl: 'https://testnet.to/api',
      },
    ],
    currency: Currency.TARA,
  },
  'telos-testnet': {
    chainId: 41,
    isTestnet: true,
    explorers: [
      {
        type: 'telos',
        webUrl: 'https://testnet.teloscan.io',
        apiUrl: 'https://api.testnet.teloscan.io/v1',
      },
    ],
    currency: Currency.TLOS,
  },
  'unichain-mainnet': {
    chainId: 130,
    isTestnet: false,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://unichain.blockscout.com',
        apiUrl: 'https://unichain.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://uniscan.xyz',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=130',
      },
    ],
    currency: Currency.ETH,
  },
  'unichain-sepolia': {
    chainId: 1301,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://unichain-sepolia.blockscout.com',
        apiUrl: 'https://unichain-sepolia.blockscout.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.uniscan.xyz',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=1301',
      },
    ],
    currency: Currency.ETH,
  },
  'world-chain-sepolia': {
    chainId: 4801,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://worldchain-sepolia.explorer.alchemy.com/',
        apiUrl: 'https://worldchain-sepolia.explorer.alchemy.com/api',
      },
      {
        type: 'etherscan',
        webUrl: 'https://sepolia.worldscan.org',
        apiUrl: 'https://api.etherscan.io/v2/api?chainid=4801',
      },
    ],
    currency: Currency.ETH,
  },
  'zephyr-testnet': {
    chainId: 1417429182,
    isTestnet: true,
    explorers: [
      {
        type: 'blockscout',
        webUrl: 'https://zephyr-blockscout.eu-north-2.gateway.fm',
        apiUrl: 'https://api.zephyr-blockscout.eu-north-2.gateway.fm/api',
      },
    ],
    currency: Currency.Z,
  },
  'zksync-mainnet': {
    chainId: 324,
    isTestnet: false,
    explorers: [
      {
        type: 'zksync',
        webUrl: 'https://explorer.zksync.io',
        apiUrl: 'https://block-explorer-api.mainnet.zksync.io/api',
      },
    ],
    currency: Currency.ETH,
  },
  'zksync-sepolia': {
    chainId: 300,
    isTestnet: true,
    explorers: [
      {
        type: 'zksync',
        webUrl: 'https://sepolia.explorer.zksync.io',
        apiUrl: 'https://block-explorer-api.sepolia.zksync.dev/api',
      },
    ],

    currency: Currency.ETH,
  },
} satisfies {
  [Net in NetworkName]: {
    chainId: ChainId | undefined;
    isTestnet: boolean;
    explorers: {
      type:
        | 'blockscout'
        | 'etherscan'
        | 'routescan'
        | 'lorescan'
        | 'socialscan'
        | 'cronos'
        | 'ontology'
        | 'telos'
        | 'zksync'
        | 'megaeth'
        | 'bitlayer'
        | 'kava'
        | 'unknown';
      webUrl: string;
      apiUrl: string | null;
    }[];
    currency: Currency;
  };
};

export function isTestnet<Net extends NetworkName>(
  network: Net,
): (typeof networkMetadata)[Net]['isTestnet'] {
  return networkMetadata[network].isTestnet;
}

export function getTxHashExplorerUrl(
  network: NetworkName,
  txhash: TxHash,
): string {
  return `${networkMetadata[network].explorers[0]?.webUrl}/tx/${txhash}`;
}

export function getAddressExplorerUrl(
  network: NetworkName,
  address: EthereumAddress,
): string {
  return `${networkMetadata[network].explorers[0]?.webUrl}/address/${address}`;
}

export type NetworkNameToRpcUrlEnvVar<Net extends NetworkName> =
  `RPC_URL_${KebabToScreamingSnakeCase<Net>}`;

export type RpcUrlEnvVarNames = NetworkNameToRpcUrlEnvVar<NetworkName>;

export function getRpcUrlEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToRpcUrlEnvVar<Net> {
  return `RPC_URL_${kebabToScreamingSnakeCase(network)}`;
}

export function getRpcUrl(network: NetworkName): string {
  const envVar = getRpcUrlEnvVar(network);
  return getEnvString(envVar);
}

export function getOptionalRpcUrl(network: NetworkName): string {
  const envVar = getRpcUrlEnvVar(network);
  return getOptionalEnvString(envVar, '');
}

export function getNetworkNameByChainId(chainId: ChainId): NetworkName {
  for (const [network, metadata] of Object.entries(networkMetadata)) {
    if (metadata.chainId === chainId) {
      return parseNetworkName(network);
    }
  }
  throw new Error(`Unknown network for Chain Id: ${chainId}`);
}

export type NetworkNameToApiKeyEnvVar<Net extends NetworkName> =
  `${KebabToScreamingSnakeCase<Net>}_API_KEY`;

export type ApiKeyEnvVarNames = NetworkNameToApiKeyEnvVar<NetworkName>;

export function getApiKeyEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToApiKeyEnvVar<Net> {
  return `${kebabToScreamingSnakeCase(network)}_API_KEY`;
}

export function getOptionalApiKey(network: NetworkName): string {
  const envVar = getApiKeyEnvVar(network);
  return getOptionalEnvString(
    envVar,
    getOptionalEnvString('ETHERSCAN_API_KEY', '0x123'),
  );
}
