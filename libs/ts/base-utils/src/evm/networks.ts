/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Schema as S } from 'effect';

import { getEnvString, getOptionalEnvString } from '../env/functions';
import { EthereumAddress, TxHash } from './hex-types';
import { KebabToSnakeCase, kebabToSnakeCase } from '../string';
import { NumberFromSelfBigIntOrString } from '../numeric';

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
  'berachain-mainnet',
  'berachain-bartio',
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
  'inevm-testnet',
  'ink-mainnet',
  'ink-sepolia',
  'kava-testnet',
  'kroma-sepolia',
  'kusama-moonbeam',
  'kusama-moonbase-alpha',
  'kusama-moonriver',
  'linea-mainnet',
  'linea-sepolia',
  'lisk-sepolia',
  'lumia-mainnet',
  'lumia-testnet',
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
  'okto-testnet',
  'ontology-testnet',
  'optimism-mainnet',
  'optimism-sepolia',
  'opbnb-testnet',
  'ozean-poseidon-testnet',
  'pharos-devnet',
  'plume-mainnet',
  'plume-testnet',
  'polygon-mainnet',
  'polygon-amoy',
  'polygon-zkevm-mainnet',
  'polygon-zkevm-cardona',
  'rollux-testnet',
  'rome-testnet',
  'rootstock-testnet',
  'scroll-mainnet',
  'scroll-sepolia',
  'shape-sepolia',
  'somnia-testnet',
  'songbird-coston',
  'sonic-mainnet',
  'sonic-blaze',
  'status-network-sepolia',
  'superseed-mainnet',
  'superseed-sepolia',
  'swellchain-testnet',
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
  43114, 43113, 8453, 84532, 80094, 80084, 80069, 200901, 200810, 81457,
  168587773, 56288, 9728, 288, 28882, 56, 97, 325000, 42220, 44787, 5115, 66665,
  338, 111557560, 18880, 250, 4002, 114, 252, 2522, 10888, 100, 10200,
  1666700000, 743111, 560048, 1663, 2424, 57073, 763373, 2221, 2358, 1284, 1287,
  1285, 59144, 59141, 4202, 994873017, 1952959480, 169, 3441006, 5000, 5003,
  1750, 59902, 6342, 31611, 10143, 2818, 2810, 8801, 5851, 10, 11155420, 5611,
  7849306, 50002, 98866, 98867, 137, 80002, 1101, 2442, 57000, 200018, 31,
  534352, 534351, 11011, 50312, 16, 146, 57054, 1660990954, 5330, 53302, 1924,
  2390, 167000, 167009, 5678, 842, 41, 130, 1301, 4801, 1417429182, 324, 300,
] as const;

export const networkName = S.Literal(...networks);
export const isNetworkName = S.is(networkName);
export const parseNetworkName = S.decodeUnknownSync(networkName);
export type NetworkName = S.Schema.Type<typeof networkName>;

export const chainId = S.compose(
  NumberFromSelfBigIntOrString,
  S.Literal(...chainIds),
);
export const isChainId = S.is(chainId);
export const parseChainId = S.decodeUnknownSync(chainId);
export type ChainId = S.Schema.Type<typeof chainId>;

export const network = S.Union(networkName, chainId);
export const isNetwork = S.is(network);
export const parseNetwork = S.decodeUnknownSync(network);
export type Network = S.Schema.Type<typeof network>;

export enum Currency {
  ETH = 'ETH',
  AVAX = 'AVAX',
  BERA = 'BERA',
  BNB = 'BNB',
  BTC = 'BTC',
  C2FLR = 'C2FLR',
  cBTC = 'cBTC',
  CELO = 'CELO',
  CETH = 'CETH',
  CFLR = 'CFLR',
  DEV = 'DEV',
  frxETH = 'frxETH',
  FTM = 'FTM',
  GLMR = 'GLMR',
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
  tRBTC = 'tRBTC',
  TSYS = 'TSYS',
  tZEN = 'tZEN',
  tZKJ = 'tZKJ',
  USDX = 'USDX',
  xDAI = 'xDAI',
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
    explorerUrl: undefined,
    currency: Currency.ETH,
  },
  'ethereum-mainnet': {
    chainId: 1,
    isTestnet: false,
    explorerUrl: 'https://etherscan.io',
    currency: Currency.ETH,
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    isTestnet: true,
    explorerUrl: 'https://sepolia.etherscan.io',
    currency: Currency.ETH,
  },
  'ethereum-holesky': {
    chainId: 17000,
    isTestnet: true,
    explorerUrl: 'https://holesky.etherscan.io',
    currency: Currency.ETH,
  },
  'abstract-testnet': {
    chainId: 11124,
    isTestnet: true,
    explorerUrl: 'https://explorer.testnet.abs.xyz',
    currency: Currency.ETH,
  },
  'arbitrum-mainnet': {
    chainId: 42161,
    isTestnet: false,
    explorerUrl: 'https://arbiscan.io',
    currency: Currency.ETH,
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    isTestnet: true,
    explorerUrl: 'https://sepolia.arbiscan.io',
    currency: Currency.ETH,
  },
  'aurora-testnet': {
    chainId: 1313161555,
    isTestnet: true,
    explorerUrl: 'https://explorer.testnet.aurora.dev',
    currency: Currency.ETH,
  },
  'avalanche-mainnet': {
    chainId: 43114,
    isTestnet: false,
    explorerUrl: 'https://snowtrace.io',
    currency: Currency.AVAX,
  },
  'avalanche-fuji': {
    chainId: 43113,
    isTestnet: true,
    explorerUrl: 'https://testnet.snowtrace.io',
    currency: Currency.AVAX,
  },
  'base-mainnet': {
    chainId: 8453,
    isTestnet: false,
    explorerUrl: 'https://basescan.org',
    currency: Currency.ETH,
  },
  'base-sepolia': {
    chainId: 84532,
    isTestnet: true,
    explorerUrl: 'https://sepolia.basescan.org',
    currency: Currency.ETH,
  },
  'berachain-mainnet': {
    chainId: 80094,
    isTestnet: false,
    explorerUrl: 'https://berascan.com',
    currency: Currency.BERA,
  },
  'berachain-bartio': {
    chainId: 80084,
    isTestnet: true,
    explorerUrl: 'https://bartio.beratrail.io',
    currency: Currency.BERA,
  },
  'berachain-bepolia': {
    chainId: 80069,
    isTestnet: true,
    explorerUrl: 'https://bepolia.beratrail.io',
    currency: Currency.BERA,
  },
  'bitlayer-mainnet': {
    chainId: 200901,
    isTestnet: false,
    explorerUrl: 'https://www.btrscan.com',
    currency: Currency.BTC,
  },
  'bitlayer-testnet': {
    chainId: 200810,
    isTestnet: true,
    explorerUrl: 'https://testnet-scan.bitlayer.org',
    currency: Currency.BTC,
  },
  'blast-mainnet': {
    chainId: 81457,
    isTestnet: false,
    explorerUrl: 'https://blastscan.io',
    currency: Currency.ETH,
  },
  'blast-sepolia': {
    chainId: 168587773,
    isTestnet: true,
    explorerUrl: 'https://sepolia.blastscan.io',
    currency: Currency.ETH,
  },
  'boba-bnb-mainnet': {
    chainId: 56288,
    isTestnet: false,
    explorerUrl: 'https://bnb.bobascan.com/',
    currency: Currency.ETH,
  },
  'boba-bnb-testnet': {
    chainId: 9728,
    isTestnet: true,
    explorerUrl: 'https://bnb.testnet.bobascan.com/',
    currency: Currency.ETH,
  },
  'boba-mainnet': {
    chainId: 288,
    isTestnet: false,
    explorerUrl: 'https://bobascan.com',
    currency: Currency.ETH,
  },
  'boba-sepolia': {
    chainId: 28882,
    isTestnet: true,
    explorerUrl: 'https://sepolia.testnet.bobascan.com',
    currency: Currency.ETH,
  },
  'bsc-mainnet': {
    chainId: 56,
    isTestnet: false,
    explorerUrl: 'https://bscscan.com',
    currency: Currency.BNB,
  },
  'bsc-testnet': {
    chainId: 97,
    isTestnet: true,
    explorerUrl: 'https://testnet.bscscan.com',
    currency: Currency.tBNB,
  },
  'camp-network-testnet-v2': {
    chainId: 325000,
    isTestnet: true,
    explorerUrl: 'https://camp-network-testnet.blockscout.com',
    currency: Currency.ETH,
  },
  'celo-mainnet': {
    chainId: 42220,
    isTestnet: false,
    explorerUrl: 'https://celoscan.com',
    currency: Currency.CELO,
  },
  'celo-alfajores': {
    chainId: 44787,
    isTestnet: true,
    explorerUrl: 'https://alfajores.celoscan.com',
    currency: Currency.CELO,
  },
  'citrea-testnet': {
    chainId: 5115,
    isTestnet: true,
    explorerUrl: 'https://explorer.testnet.citrea.xyz',
    currency: Currency.cBTC,
  },
  'creator-chain-testnet': {
    chainId: 66665,
    isTestnet: true,
    explorerUrl: 'https://explorer.creatorchain.io',
    currency: Currency.CETH,
  },
  'cronos-testnet': {
    chainId: 338,
    isTestnet: true,
    explorerUrl: 'https://explorer.cronos.org/testnet',
    currency: Currency.TCRO,
  },
  'cyber-testnet': {
    chainId: 111557560,
    isTestnet: true,
    explorerUrl: 'https://cyber-testnet.socialscan.io',
    currency: Currency.ETH,
  },
  'expchain-testnet': {
    chainId: 18880,
    isTestnet: true,
    explorerUrl: 'https://blockscout-testnet.expchain.ai',
    currency: Currency.tZKJ,
  },
  'fantom-mainnet': {
    chainId: 250,
    isTestnet: false,
    explorerUrl: 'https://ftmscan.com',
    currency: Currency.FTM,
  },
  'fantom-testnet': {
    chainId: 4002,
    isTestnet: true,
    explorerUrl: 'https://testnet.ftmscan.com',
    currency: Currency.tFTM,
  },
  'flare-coston': {
    chainId: 114,
    isTestnet: true,
    explorerUrl: 'https://coston2.testnet.flarescan.com',
    currency: Currency.C2FLR,
  },
  'fraxtal-mainnet': {
    chainId: 252,
    isTestnet: false,
    explorerUrl: 'https://fraxscan.com',
    currency: Currency.frxETH,
  },
  'fraxtal-testnet': {
    chainId: 2522,
    isTestnet: true,
    explorerUrl: 'https://holesky.fraxscan.com',
    currency: Currency.frxETH,
  },
  'gameswift-chain-testnet': {
    chainId: 10888,
    isTestnet: true,
    explorerUrl: 'https://testnet.gameswift.io',
    currency: Currency.tGS,
  },
  'gnosis-mainnet': {
    chainId: 100,
    isTestnet: false,
    explorerUrl: 'https://gnosisscan.io',
    currency: Currency.xDAI,
  },
  'gnosis-chiado': {
    chainId: 10200,
    isTestnet: true,
    explorerUrl: 'https://gnosis-chiado.blockscout.com',
    currency: Currency.xDAI,
  },
  'harmony-testnet-shard0': {
    chainId: 1666700000,
    isTestnet: true,
    explorerUrl: 'https://explorer.testnet.harmony.one/',
    currency: Currency.ONE,
  },
  'hemi-sepolia': {
    chainId: 743111,
    isTestnet: true,
    explorerUrl: 'https://testnet.explorer.hemi.xyz',
    currency: Currency.ETH,
  },
  'hoodi-testnet': {
    chainId: 560048,
    isTestnet: true,
    explorerUrl: 'https://testnet.explorer.hemi.xyz',
    currency: Currency.ETH,
  },
  'horizen-gobi': {
    chainId: 1663,
    isTestnet: true,
    explorerUrl: 'https://gobi-explorer.horizenlabs.io/',
    currency: Currency.tZEN,
  },
  'inevm-testnet': {
    chainId: 2424,
    isTestnet: true,
    explorerUrl: 'https://testnet.explorer.inevm.com/',
    currency: Currency.INJ,
  },
  'ink-mainnet': {
    chainId: 57073,
    isTestnet: false,
    explorerUrl: 'https://explorer.inkonchain.com',
    currency: Currency.ETH,
  },
  'ink-sepolia': {
    chainId: 763373,
    isTestnet: true,
    explorerUrl: 'https://explorer-sepolia.inkonchain.com/',
    currency: Currency.ETH,
  },
  'kava-testnet': {
    chainId: 2221,
    isTestnet: true,
    explorerUrl: '',
    currency: Currency.KAVA,
  },
  'kroma-sepolia': {
    chainId: 2358,
    isTestnet: true,
    explorerUrl: 'https://blockscout.sepolia.kroma.network',
    currency: Currency.ETH,
  },
  'kusama-moonbeam': {
    chainId: 1284,
    isTestnet: false,
    explorerUrl: 'https://moonbeam.moonscan.io',
    currency: Currency.GLMR,
  },
  'kusama-moonbase-alpha': {
    chainId: 1287,
    isTestnet: true,
    explorerUrl: 'https://moonbase.moonscan.io',
    currency: Currency.DEV,
  },
  'kusama-moonriver': {
    chainId: 1285,
    isTestnet: false,
    explorerUrl: 'https://moonriver.moonscan.io',
    currency: Currency.MOVR,
  },
  'linea-mainnet': {
    chainId: 59144,
    isTestnet: false,
    explorerUrl: 'https://lineascan.build',
    currency: Currency.ETH,
  },
  'linea-sepolia': {
    chainId: 59141,
    isTestnet: true,
    explorerUrl: 'https://sepolia.lineascan.build',
    currency: Currency.ETH,
  },
  'lisk-sepolia': {
    chainId: 4202,
    isTestnet: true,
    explorerUrl: 'https://sepolia-blockscout.lisk.com',
    currency: Currency.ETH,
  },
  'lumia-mainnet': {
    chainId: 994873017,
    isTestnet: false,
    explorerUrl: 'https://explorer.lumia.org',
    currency: Currency.LUMIA,
  },
  'lumia-testnet': {
    chainId: 1952959480,
    isTestnet: true,
    explorerUrl: 'https://testnet-explorer.lumia.org',
    currency: Currency.LUMIA,
  },
  'manta-mainnet': {
    chainId: 169,
    isTestnet: false,
    explorerUrl: 'https://pacific-explorer.manta.network',
    currency: Currency.ETH,
  },
  'manta-sepolia': {
    chainId: 3441006,
    isTestnet: true,
    explorerUrl: 'https://pacific-explorer.sepolia-testnet.manta.network',
    currency: Currency.ETH,
  },
  'mantle-mainnet': {
    chainId: 5000,
    isTestnet: false,
    explorerUrl: 'https://mantlescan.xyz',
    currency: Currency.MNT,
  },
  'mantle-sepolia': {
    chainId: 5003,
    isTestnet: true,
    explorerUrl: 'https://sepolia.mantlescan.xyz/',
    currency: Currency.MNT,
  },
  'metal-l2-testnet': {
    chainId: 1750,
    isTestnet: true,
    explorerUrl: 'https://testnet.explorer.metall2.com',
    currency: Currency.ETH,
  },
  'metis-andromeda-mainnet': {
    chainId: 1088,
    isTestnet: false,
    explorerUrl: 'https://andromeda.guru.com',
    currency: Currency.METIS,
  },
  'metis-sepolia': {
    chainId: 59902,
    isTestnet: true,
    explorerUrl: 'https://sepolia-explorer.metisdevops.link',
    currency: Currency.sMETIS,
  },
  'megaeth-testnet': {
    chainId: 6342,
    isTestnet: true,
    explorerUrl: 'https://www.megaexplorer.xyz',
    currency: Currency.ETH,
  },
  'mezo-matsnet-testnet': {
    chainId: 31611,
    isTestnet: true,
    explorerUrl: 'https://explorer.test.mezo.org',
    currency: Currency.BTC,
  },
  'monad-testnet': {
    chainId: 10143,
    isTestnet: true,
    explorerUrl: 'https://testnet.monadexplorer.com',
    currency: Currency.MON,
  },
  'morph-mainnet': {
    chainId: 2818,
    isTestnet: false,
    explorerUrl: 'https://explorer.morphl2.io',
    currency: Currency.ETH,
  },
  'morph-holesky': {
    chainId: 2810,
    isTestnet: true,
    explorerUrl: 'https://explorer-holesky.morphl2.io',
    currency: Currency.ETH,
  },
  'okto-testnet': {
    chainId: 8801,
    isTestnet: true,
    explorerUrl: 'https://testnet.okto.tech',
    currency: Currency.OKTO,
  },
  'ontology-testnet': {
    chainId: 5851,
    isTestnet: true,
    explorerUrl: 'https://explorer.ont.io/testnet',
    currency: Currency.ONG,
  },
  'optimism-mainnet': {
    chainId: 10,
    isTestnet: false,
    explorerUrl: 'https://optimistic.etherscan.io',
    currency: Currency.ETH,
  },
  'optimism-sepolia': {
    chainId: 11155420,
    isTestnet: true,
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    currency: Currency.ETH,
  },
  'opbnb-testnet': {
    chainId: 5611,
    isTestnet: true,
    explorerUrl: 'https://opbnb-testnet.bscscan.com',
    currency: Currency.tBNB,
  },
  'ozean-poseidon-testnet': {
    chainId: 7849306,
    isTestnet: true,
    explorerUrl: 'https://ozean-testnet.explorer.caldera.xyz',
    currency: Currency.USDX,
  },
  'pharos-devnet': {
    chainId: 50002,
    isTestnet: true,
    explorerUrl: 'https://pharosscan.xyz',
    currency: Currency.ETH,
  },
  'plume-mainnet': {
    chainId: 98866,
    isTestnet: false,
    explorerUrl: 'https://phoenix-explorer.plumenetwork.xyz',
    currency: Currency.PLUME,
  },
  'plume-testnet': {
    chainId: 98867,
    isTestnet: true,
    explorerUrl: 'https://testnet-explorer.plumenetwork.xyz',
    currency: Currency.PLUME,
  },
  'polygon-mainnet': {
    chainId: 137,
    isTestnet: false,
    explorerUrl: 'https://polygonscan.com',
    currency: Currency.MATIC,
  },
  'polygon-amoy': {
    chainId: 80002,
    isTestnet: true,
    explorerUrl: 'https://amoy.polygonscan.com',
    currency: Currency.POL,
  },
  'polygon-zkevm-mainnet': {
    chainId: 1101,
    isTestnet: false,
    explorerUrl: 'https://zkevm.polygonscan.com',
    currency: Currency.ETH,
  },
  'polygon-zkevm-cardona': {
    chainId: 2442,
    isTestnet: true,
    explorerUrl: 'https://cardona-zkevm.polygonscan.com',
    currency: Currency.ETH,
  },
  'rollux-testnet': {
    chainId: 57000,
    isTestnet: true,
    explorerUrl: 'https://rollux.tanenbaum.io',
    currency: Currency.TSYS,
  },
  'rome-testnet': {
    chainId: 200018,
    isTestnet: true,
    explorerUrl: 'https://rome.testnet.romeprotocol.xyz:1000',
    currency: Currency.ROME,
  },
  'rootstock-testnet': {
    chainId: 31,
    isTestnet: true,
    explorerUrl: 'https://explorer.testnet.rootstock.io',
    currency: Currency.tRBTC,
  },
  'scroll-mainnet': {
    chainId: 534352,
    isTestnet: false,
    explorerUrl: 'https://scroll.io',
    currency: Currency.ETH,
  },
  'scroll-sepolia': {
    chainId: 534351,
    isTestnet: true,
    explorerUrl: 'https://sepolia.scrollscan.com',
    currency: Currency.ETH,
  },
  'shape-sepolia': {
    chainId: 11011,
    isTestnet: true,
    explorerUrl: 'https://explorer.test.mezo.org',
    currency: Currency.ETH,
  },
  'somnia-testnet': {
    chainId: 50312,
    isTestnet: true,
    explorerUrl: 'https://somnia-testnet.socialscan.io',
    currency: Currency.STT,
  },
  'songbird-coston': {
    chainId: 16,
    isTestnet: true,
    explorerUrl: 'https://coston-explorer.flare.network',
    currency: Currency.CFLR,
  },
  'sonic-mainnet': {
    chainId: 146,
    isTestnet: false,
    explorerUrl: 'https://sonicscan.org',
    currency: Currency.S,
  },
  'sonic-blaze': {
    chainId: 57054,
    isTestnet: true,
    explorerUrl: 'https://testnet.sonicscan.org/',
    currency: Currency.S,
  },
  'status-network-sepolia': {
    chainId: 1660990954,
    isTestnet: true,
    explorerUrl: 'https://sepoliascan.status.network',
    currency: Currency.ETH,
  },
  'superseed-mainnet': {
    chainId: 5330,
    isTestnet: false,
    explorerUrl: 'https://explorer.superseed.xyz',
    currency: Currency.ETH,
  },
  'superseed-sepolia': {
    chainId: 53302,
    isTestnet: true,
    explorerUrl: 'https://sepolia-explorer.superseed.xyz',
    currency: Currency.ETH,
  },
  'swellchain-testnet': {
    chainId: 1924,
    isTestnet: true,
    explorerUrl: 'https://swell-testnet-explorer.alt.technology',
    currency: Currency.ETH,
  },
  'tac-turin': {
    chainId: 2390,
    isTestnet: true,
    explorerUrl: 'https://turin.explorer.tac.build',
    currency: Currency.TAC,
  },
  'taiko-mainnet': {
    chainId: 167000,
    isTestnet: false,
    explorerUrl: 'https://taikoscan.io',
    currency: Currency.ETH,
  },
  'taiko-hekla': {
    chainId: 167009,
    isTestnet: true,
    explorerUrl: 'https://hekla.taikoscan.io',
    currency: Currency.ETH,
  },
  'tanssi-demo': {
    chainId: 5678,
    isTestnet: true,
    explorerUrl: 'https://fra-dancebox-3001-bs.a.dancebox.tanssi.network',
    currency: Currency.TANGO,
  },
  'taraxa-testnet': {
    chainId: 842,
    isTestnet: true,
    explorerUrl: 'https://testnet.explorer.taraxa.io',
    currency: Currency.TARA,
  },
  'telos-testnet': {
    chainId: 41,
    isTestnet: true,
    explorerUrl: 'https://testnet.teloscan.io',
    currency: Currency.TLOS,
  },
  'unichain-mainnet': {
    chainId: 130,
    isTestnet: false,
    explorerUrl: 'https://unichain.blockscout.com',
    currency: Currency.ETH,
  },
  'unichain-sepolia': {
    chainId: 1301,
    isTestnet: true,
    explorerUrl: 'https://unichain-sepolia.blockscout.com',
    currency: Currency.ETH,
  },
  'world-chain-sepolia': {
    chainId: 4801,
    isTestnet: true,
    explorerUrl: 'https://worldchain-sepolia.explorer.alchemy.com',
    currency: Currency.ETH,
  },
  'zephyr-testnet': {
    chainId: 1417429182,
    isTestnet: true,
    explorerUrl: 'https://zephyr-blockscout.eu-north-2.gateway.fm',
    currency: Currency.Z,
  },
  'zksync-mainnet': {
    chainId: 324,
    isTestnet: false,
    explorerUrl: 'https://zksync.blockscout.com',
    currency: Currency.ETH,
  },
  'zksync-sepolia': {
    chainId: 300,
    isTestnet: true,
    explorerUrl: 'https://zksync-sepolia.blockscout.com',
    currency: Currency.ETH,
  },
} satisfies {
  [Net in NetworkName]: {
    chainId: ChainId | undefined;
    isTestnet: boolean;
    explorerUrl: string | undefined;
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
  return `${networkMetadata[network].explorerUrl}/tx/${txhash}`;
}

export function getAddressExplorerUrl(
  network: NetworkName,
  address: EthereumAddress,
): string {
  return `${networkMetadata[network].explorerUrl}/address/${address}`;
}

export type NetworkNameToEnvVar<Net extends NetworkName> =
  `RPC_URL_${KebabToSnakeCase<Net>}`;

export type RpcUrlEnvVarNames = NetworkNameToEnvVar<NetworkName>;

export function getRpcUrlEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToEnvVar<Net> {
  return `RPC_URL_${kebabToSnakeCase(network)}`;
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
