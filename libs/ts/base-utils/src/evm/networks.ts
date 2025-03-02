/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { Schema as S } from 'effect';

import {
  getEnvString,
  getEnvStringNotAssert,
  getOptionalEnvString,
} from '../env/functions';
import { EthereumAddress, TxHash } from './hex-types';
import { KebabToSnakeCase, kebabToSnakeCase } from '../string';
import { NumberFromSelfBigIntOrString } from '../numeric';
import { assertNotNull } from '../assert';

const networks = [
  'local',
  'ethereum-mainnet',
  'ethereum-sepolia',
  'ethereum-holesky',
  'abstract-sepolia',
  'metis-andromeda',
  'metis-sepolia',
  'arbitrum-mainnet',
  'arbitrum-sepolia',
  'aurora-testnet',
  'avalanche-mainnet',
  'avalanche-fuji',
  'base-mainnet',
  'base-sepolia',
  'berachain-bartio',
  'blast-sepolia',
  'bsc-mainnet',
  'bsc-testnet',
  'celo-mainnet',
  'celo-alfajores',
  'citrea-testnet',
  'cronos-mainnet',
  'cronos-testnet',
  'cronos-zkevm-mainnet',
  'cronos-zkevm-sepolia',
  'fantom-mainnet',
  'fantom-testnet',
  'flare-coston2',
  'gnosis-mainnet',
  'gnosis-chiado',
  'harmony-testnet-shard0',
  'horizen-gobi',
  'inevm-testnet',
  'ink-sepolia',
  'kroma-mainnet',
  'kroma-sepolia',
  'kusama-moonriver',
  'linea-mainnet',
  'linea-sepolia',
  'manta-mainnet',
  'manta-sepolia',
  'mantle-mainnet',
  'mantle-sepolia',
  'mezo-matsnet-testnet',
  'monad-testnet',
  'morph-mainnet',
  'morph-holesky',
  'optimism-mainnet',
  'optimism-sepolia',
  'opbnb-mainnet',
  'opbnb-testnet',
  'polygon-mainnet',
  'polygon-amoy',
  'polygon-zkevm-mainnet',
  'polygon-zkevm-cardona',
  'rollux-mainnet',
  'rollux-testnet',
  'scroll-mainnet',
  'scroll-sepolia',
  'shape-mainnet',
  'shape-sepolia',
  'flare-songbird-coston',
  'sonic-mainnet',
  'sonic-blaze',
  'taiko-mainnet',
  'taiko-hekla',
  'telos-mainnet',
  'telos-testnet',
  'zksync-mainnet',
  'zksync-sepolia',
  'world-chain-sepolia',
] as const;

const chainIds = [
  99999999999, 1, 11155111, 17000, 11124, 1088, 59902, 42161, 421614,
  1313161555, 43114, 43113, 8453, 84532, 80084, 168587773, 56, 97, 42220, 44787,
  5115, 25, 338, 388, 240, 250, 4002, 114, 100, 10200, 1666700000, 1663, 2424,
  763373, 255, 2358, 1285, 59144, 59141, 169, 3441006, 5000, 5003, 31611, 41454,
  10143, 2818, 2810, 10, 11155420, 204, 5611, 137, 80002, 1101, 2442, 570,
  57000, 534352, 534351, 360, 11011, 16, 146, 57054, 167000, 167009, 40, 41,
  324, 300, 4801,
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
  CFLR = 'CFLR',
  CRO = 'CRO',
  MON = 'MON',
  FTM = 'FTM',
  INJ = 'INJ',
  MATIC = 'MATIC',
  METIS = 'METIS',
  sMETIS = 'sMETIS',
  MNT = 'MNT',
  MOVR = 'MOVR',
  ONE = 'ONE',
  POL = 'POL',
  S = 'S',
  tBNB = 'tBNB',
  TCRO = 'TCRO',
  tFTM = 'tFTM',
  SYS = 'SYS',
  TSYS = 'TSYS',
  TLOS = 'TLOS',
  tZEN = 'tZEN',
  xDAI = 'xDAI',
}

/**
 * Mapping of network names to explorer URLs
 * The URL generator functions take a transaction hash or an address as input and return the corresponding explorer URL.
 */
export const networkMetadata = {
  local: {
    chainId: 99999999999,
    isTestnet: false,
    explorer: null,
    currency: Currency.ETH,
  },
  'ethereum-mainnet': {
    chainId: 1,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://etherscan.io',
      apiUrl: 'https://api.etherscan.io/api',
    },
    currency: Currency.ETH,
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.etherscan.io',
      apiUrl: 'https://api-sepolia.etherscan.io/api',
    },
    currency: Currency.ETH,
  },
  'ethereum-holesky': {
    chainId: 17000,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://holesky.etherscan.io',
      apiUrl: 'https://api-holesky.etherscan.io/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.abs.xyz/connect-to-abstract#connect-to-abstract
  'abstract-sepolia': {
    chainId: 11124,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.abscan.org',
      apiUrl: 'https://api-sepolia.abscan.org/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.metis.io/dapp/infra/rpcs
  'metis-andromeda': {
    chainId: 1088,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://andromeda-explorer.metis.io',
      apiUrl: 'https://andromeda-explorer.metis.io/api/v2',
    },
    currency: Currency.METIS,
  },
  'metis-sepolia': {
    chainId: 59902,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://sepolia-explorer.metisdevops.link',
      apiUrl: 'https://sepolia-explorer-api.metisdevops.link/api/v2',
    },
    currency: Currency.sMETIS,
  },

  'arbitrum-mainnet': {
    chainId: 42161,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://arbiscan.io',
      apiUrl: 'https://api.arbiscan.io/api',
    },
    currency: Currency.ETH,
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.arbiscan.io',
      apiUrl: 'https://api-sepolia.arbiscan.io/api',
    },
    currency: Currency.ETH,
  },

  'aurora-testnet': {
    chainId: 1313161555,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.testnet.aurora.dev',
      apiUrl: 'https://explorer.testnet.aurora.dev/api',
    },
    currency: Currency.ETH,
  },

  'avalanche-mainnet': {
    chainId: 43114,
    isTestnet: false,
    explorer: {
      type: 'routescan',
      webUrl: 'https://snowtrace.io',
      apiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
    },
    currency: Currency.AVAX,
  },
  'avalanche-fuji': {
    chainId: 43113,
    isTestnet: true,
    explorer: {
      type: 'routescan',
      webUrl: 'https://testnet.snowtrace.io',
      apiUrl: 'https://api.routescan.io/v2/network/mainnet/evm/43113/etherscan',
    },
    currency: Currency.AVAX,
  },

  'base-mainnet': {
    chainId: 8453,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org/api',
    },
    currency: Currency.ETH,
  },
  'base-sepolia': {
    chainId: 84532,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.basescan.org',
      apiUrl: 'https://api-sepolia.basescan.org/api',
    },
    currency: Currency.ETH,
  },
  'berachain-bartio': {
    chainId: 80084,
    isTestnet: true,
    explorer: {
      type: 'routescan',
      webUrl: 'https://bartio.beratrail.io',
      apiUrl: 'https://api.routescan.io/v2/network/testnet/evm/80084/etherscan',
    },
    currency: Currency.BERA,
  },
  'blast-sepolia': {
    chainId: 168587773,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.blastscan.io',
      apiUrl: 'https://api-sepolia.blastscan.io/api',
    },
    currency: Currency.ETH,
  },
  'bsc-mainnet': {
    chainId: 56,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://bscscan.com',
      apiUrl: 'https://api.bscscan.com/api',
    },
    currency: Currency.BNB,
  },
  'bsc-testnet': {
    chainId: 97,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://testnet.bscscan.com',
      apiUrl: 'https://api-testnet.bscscan.com/api',
    },
    currency: Currency.tBNB,
  },
  'celo-mainnet': {
    chainId: 42220,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://celoscan.io',
      apiUrl: 'https://api.celoscan.io/api',
    },
    currency: Currency.CELO,
  },
  'celo-alfajores': {
    chainId: 44787,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://alfajores.celoscan.com',
      apiUrl: 'https://api-alfajores.celoscan.io/api',
    },
    currency: Currency.CELO,
  },
  'citrea-testnet': {
    chainId: 5115,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.testnet.citrea.xyz',
      apiUrl: 'https://explorer.testnet.citrea.xyz/api',
    },
    currency: Currency.cBTC,
  },

  // https://docs.cronos.org/for-users/metamask#mainnet
  'cronos-mainnet': {
    chainId: 25,
    isTestnet: false,
    explorer: {
      type: 'cronos',
      webUrl: 'https://explorer.cronos.org',
      apiUrl: 'https://explorer-api.cronos.org/testnet/api/v1',
    },
    currency: Currency.CRO,
  },
  'cronos-testnet': {
    chainId: 338,
    isTestnet: true,
    explorer: {
      type: 'cronos',
      webUrl: 'https://explorer.cronos.org/testnet',
      apiUrl: 'https://explorer-api.cronos.org/testnet/api/v1',
    },
    currency: Currency.TCRO,
  },

  // https://docs-zkevm.cronos.org/getting-started/network-status
  'cronos-zkevm-mainnet': {
    chainId: 388,
    isTestnet: false,
    explorer: {
      type: 'cronos',
      webUrl: 'https://explorer.zkevm.cronos.org',
      apiUrl: 'https://explorer-api.cronos.org/testnet/api/v1',
    },
    currency: Currency.ETH,
  },
  'cronos-zkevm-sepolia': {
    chainId: 240,
    isTestnet: true,
    explorer: {
      type: 'cronos',
      webUrl: 'https://explorer.zkevm.cronos.org/testnet',
      apiUrl: 'https://explorer-api.testnet.zkevm.cronos.org/api/v1/',
    },
    currency: Currency.ETH,
  },

  // https://docs.fantom.foundation/build-on-opera/api/public-endpoints
  'fantom-mainnet': {
    chainId: 250,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://ftmscan.com',
      apiUrl: 'https://api.ftmscan.com/api',
    },
    currency: Currency.FTM,
  },
  'fantom-testnet': {
    chainId: 4002,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://testnet.ftmscan.com',
      apiUrl: 'https://api-testnet.ftmscan.com/api',
    },
    currency: Currency.tFTM,
  },

  // https://docs.flare.network/user/wallets/
  'flare-coston2': {
    chainId: 114,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://coston2-explorer.flare.network',
      apiUrl: 'https://coston2-explorer.flare.network/api',
    },
    currency: Currency.C2FLR,
  },

  // https://docs.gnosischain.com/about/networks/#networks-summary
  'gnosis-mainnet': {
    chainId: 100,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://gnosisscan.io',
      apiUrl: 'https://api.gnosisscan.io/api',
    },
    currency: Currency.xDAI,
  },
  'gnosis-chiado': {
    chainId: 10200,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://gnosis-chiado.blockscout.com',
      apiUrl: 'https://gnosis-chiado.blockscout.com/api',
    },
    currency: Currency.xDAI,
  },

  // https://docs.harmony.one/home/developers/getting-started/network-and-faucets
  'harmony-testnet-shard0': {
    chainId: 1666700000,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.testnet.harmony.one',
      apiUrl: 'https://explorer.testnet.harmony.one/api',
    },
    currency: Currency.ONE,
  },

  'horizen-gobi': {
    chainId: 1663,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://gobi-explorer.horizenlabs.io',
      apiUrl: 'https://gobi-explorer-api.horizenlabs.io/api',
    },
    currency: Currency.tZEN,
  },

  // https://docs.inevm.com/getting-started/add-inevm-to-metamask#mainnet
  'inevm-testnet': {
    chainId: 2424,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://testnet.explorer.inevm.com',
      apiUrl: 'https://testnet.explorer.inevm.com/api',
    },
    currency: Currency.INJ,
  },

  // https://docs.inkonchain.com/tools/block-explorers
  'ink-sepolia': {
    chainId: 763373,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer-sepolia.inkonchain.com',
      apiUrl: 'https://explorer-sepolia.inkonchain.com/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.kroma.network/builders/network-information
  'kroma-mainnet': {
    chainId: 255,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://blockscout.kroma.network',
      apiUrl: 'https://blockscout.kroma.network/api',
    },
    currency: Currency.ETH,
  },
  // https://docs.kroma.network/builders/testnet/setup
  'kroma-sepolia': {
    chainId: 2358,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://blockscout.sepolia.kroma.network',
      apiUrl: 'https://blockscout.sepolia.kroma.network/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.moonbeam.network/builders/get-started/quick-start/#network-configurations
  'kusama-moonriver': {
    chainId: 1285,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://moonriver.moonscan.io',
      apiUrl: 'https://api-moonriver.moonscan.io/api',
    },
    currency: Currency.MOVR,
  },

  // https://docs.linea.network/builders/networks
  // https://docs.linea.build/get-started/build/block-explorers
  // https://docs.lineascan.build/getting-started/endpoint-urls
  'linea-mainnet': {
    chainId: 59144,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://lineascan.build',
      apiUrl: 'https://api.lineascan.build/api',
    },
    currency: Currency.ETH,
  },
  'linea-sepolia': {
    chainId: 59141,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.lineascan.build',
      apiUrl: 'https://api-sepolia.lineascan.build/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.manta.network/docs/manta-pacific/Build%20on%20Manta/Network%20Information
  // https://docs.manta.network/docs/manta-pacific/Tools/Block%20Explorers
  'manta-mainnet': {
    chainId: 169,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://pacific-explorer.manta.network',
      apiUrl: 'https://pacific-explorer.manta.network/api',
    },
    currency: Currency.ETH,
  },
  'manta-sepolia': {
    chainId: 3441006,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://pacific-explorer.sepolia-testnet.manta.network',
      apiUrl: 'https://pacific-explorer.sepolia-testnet.manta.network/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.mantle.xyz/network/for-developers/quick-access
  'mantle-mainnet': {
    chainId: 5000,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://mantlescan.xyz',
      apiUrl: 'https://api.mantlescan.xyz/api',
    },
    currency: Currency.MNT,
  },
  'mantle-sepolia': {
    chainId: 5003,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.mantlescan.xyz',
      apiUrl: 'https://api-sepolia.mantlescan.xyz/api',
    },
    currency: Currency.MNT,
  },

  // https://mezo.org/docs/users/getting-started/mezo-matsnet-alpha-testnet/connect-to-mezo-matsnet
  'mezo-matsnet-testnet': {
    chainId: 31611,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.test.mezo.org',
      apiUrl: 'https://explorer.test.mezo.org/api',
    },
    currency: Currency.BTC,
  },

  // https://docs.monad.xyz/getting-started/network-information#monad-testnet
  'monad-testnet': {
    chainId: 10143,
    isTestnet: true,
    explorer: {
      type: 'blockvision',
      webUrl: 'https://testnet.monadexplorer.com',
      // https://docs.blockvision.org/reference/retrieve-monad-account-transactions
      apiUrl: 'https://api.blockvision.org/v2/monad/',
    },
    currency: Currency.MON,
  },

  // https://docs.morphl2.io/docs/build-on-morph/build-on-morph/integration-one-page/
  'morph-mainnet': {
    chainId: 2818,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.morphl2.io',
      apiUrl: 'https://explorer.morphl2.io/api',
    },
    currency: Currency.ETH,
  },
  'morph-holesky': {
    chainId: 2810,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer-holesky.morphl2.io',
      apiUrl: 'https://explorer-holesky.morphl2.io/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.optimism.io/app-developers/tools/connect/networks
  'optimism-mainnet': {
    chainId: 10,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://optimistic.etherscan.io',
      apiUrl: 'https://api-optimistic.etherscan.io/api',
    },
    currency: Currency.ETH,
  },
  'optimism-sepolia': {
    chainId: 11155420,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia-optimism.etherscan.io',
      apiUrl: 'https://api-sepolia-optimistic.etherscan.io/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.bnbchain.org/bnb-opbnb/get-started/network-info/
  // https://docs.bscscan.com/opbnb/getting-started/endpoint-urls
  'opbnb-mainnet': {
    chainId: 204,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://opbnb.bscscan.com/',
      apiUrl: 'https://api-opbnb.bscscan.com/api',
    },
    currency: Currency.BNB,
  },
  'opbnb-testnet': {
    chainId: 5611,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://opbnb-testnet.bscscan.com',
      apiUrl: 'https://api-opbnb-testnet.bscscan.com/api',
    },
    currency: Currency.tBNB,
  },

  // https://docs.polygon.technology/tools/wallets/metamask/add-polygon-network/?h=network#add-a-network-manually
  // https://docs.polygonscan.com/getting-started/endpoint-urls
  'polygon-mainnet': {
    chainId: 137,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://polygonscan.com',
      apiUrl: 'https://api.polygonscan.com/api',
    },
    currency: Currency.MATIC,
  },
  'polygon-amoy': {
    chainId: 80002,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://amoy.polygonscan.com',
      apiUrl: 'https://api-amoy.polygonscan.com/api',
    },
    currency: Currency.POL,
  },
  'polygon-zkevm-mainnet': {
    chainId: 1101,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://zkevm.polygonscan.com',
      apiUrl: 'https://api-zkevm.polygonscan.com/api',
    },
    currency: Currency.ETH,
  },
  'polygon-zkevm-cardona': {
    chainId: 2442,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://cardona-zkevm.polygonscan.com',
      apiUrl: 'https://api-cardona-zkevm.polygonscan.com/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.rollux.com/docs/useful-tools/networks/
  'rollux-mainnet': {
    chainId: 570,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer.rollux.com/',
      apiUrl: 'https://explorer.rollux.com/api',
    },
    currency: Currency.SYS,
  },
  'rollux-testnet': {
    chainId: 57000,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://rollux.tanenbaum.io',
      apiUrl: 'https://rollux.tanenbaum.io/api',
    },
    currency: Currency.TSYS,
  },

  // https://docs.scroll.io/en/developers/developer-quickstart/#network-configuration
  'scroll-mainnet': {
    chainId: 534352,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://scrollscan.com',
      apiUrl: 'https://api.scrollscan.com/api',
    },
    currency: Currency.ETH,
  },
  'scroll-sepolia': {
    chainId: 534351,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sepolia.scrollscan.com',
      apiUrl: 'https://api-sepolia.scrollscan.com/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.shape.network/documentation/technical-details/network-information
  'shape-mainnet': {
    chainId: 360,
    isTestnet: false,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://shapescan.xyz/',
      apiUrl: 'https://shapescan.xyz/api',
    },
    currency: Currency.ETH,
  },
  'shape-sepolia': {
    chainId: 11011,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://explorer-sepolia.shape.network',
      apiUrl: 'https://explorer-sepolia.shape.network/api',
    },
    currency: Currency.ETH,
  },

  'flare-songbird-coston': {
    chainId: 16,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://coston-explorer.flare.network',
      apiUrl: 'https://coston-explorer.flare.network/api',
    },
    currency: Currency.CFLR,
  },

  // https://docs.soniclabs.com/sonic/build-on-sonic/getting-started
  // https://docs.sonicscan.org/getting-started/endpoint-urls
  'sonic-mainnet': {
    chainId: 146,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://sonicscan.org',
      apiUrl: 'https://api.sonicscan.org/api',
    },
    currency: Currency.S,
  },
  'sonic-blaze': {
    chainId: 57054,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://testnet.sonicscan.org',
      apiUrl: 'https://api-testnet.sonicscan.org/api',
    },
    currency: Currency.S,
  },

  // https://docs.taiko.xyz/network-reference/rpc-configuration/
  'taiko-mainnet': {
    chainId: 167000,
    isTestnet: false,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://taikoscan.io',
      apiUrl: 'https://api.taikoscan.io/api',
    },
    currency: Currency.ETH,
  },
  'taiko-hekla': {
    chainId: 167009,
    isTestnet: true,
    explorer: {
      type: 'etherscan',
      webUrl: 'https://hekla.taikoscan.io',
      apiUrl: 'https://api-hekla.taikoscan.io/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.telos.net/build/network-info/
  'telos-mainnet': {
    chainId: 40,
    isTestnet: false,
    explorer: {
      type: 'unknown',
      webUrl: 'https://teloscan.io',
      apiUrl: 'https://api.teloscan.io/api',
    },
    currency: Currency.TLOS,
  },
  'telos-testnet': {
    chainId: 41,
    isTestnet: true,
    explorer: {
      type: 'unknown',
      webUrl: 'https://testnet.teloscan.io',
      apiUrl: 'https://api.testnet.teloscan.io',
    },
    currency: Currency.TLOS,
  },

  // https://docs.zksync.io/zksync-era/environment#mainnet-network-details
  'zksync-mainnet': {
    chainId: 324,
    isTestnet: false,
    explorer: {
      type: 'unknown',
      webUrl: 'https://explorer.zksync.io',
      apiUrl: 'https://block-explorer-api.mainnet.zksync.io/api',
    },
    currency: Currency.ETH,
  },
  'zksync-sepolia': {
    chainId: 300,
    isTestnet: true,
    explorer: {
      type: 'unknown',
      webUrl: 'https://sepolia.explorer.zksync.io',
      apiUrl: 'https://block-explorer-api.sepolia.zksync.dev/api',
    },
    currency: Currency.ETH,
  },

  // https://docs.world.org/world-chain/quick-start/info
  'world-chain-sepolia': {
    chainId: 4801,
    isTestnet: true,
    explorer: {
      type: 'blockscout',
      webUrl: 'https://worldchain-sepolia.explorer.alchemy.com',
      apiUrl: 'https://worldchain-sepolia.explorer.alchemy.com/api',
    },
    currency: Currency.ETH,
  },
} satisfies {
  [Net in NetworkName]: {
    chainId: ChainId | undefined;
    isTestnet: boolean;
    explorer: {
      type:
        | 'blockscout'
        | 'blockvision'
        | 'etherscan'
        | 'routescan'
        | 'lorescan'
        | 'cronos'
        | 'unknown';
      webUrl: string;
      apiUrl: string;
    } | null;
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
  const explorer = assertNotNull(networkMetadata[network].explorer);
  return `${explorer.webUrl}/tx/${txhash}`;
}

export function getAddressExplorerUrl(
  network: NetworkName,
  address: EthereumAddress,
): string {
  const explorer = assertNotNull(networkMetadata[network].explorer);
  return `${explorer.webUrl}/address/${address}`;
}

export type NetworkNameToEnvVar<Net extends NetworkName> =
  `RPC_URL_${KebabToSnakeCase<Net>}`;

export type NetworkNameToExplorerApiKeyEnvVar<Net extends NetworkName> =
  `${KebabToSnakeCase<Net>}_API_KEY`;

export type RpcUrlEnvVarNames = NetworkNameToEnvVar<NetworkName>;

export function getRpcUrlEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToEnvVar<Net> {
  return `RPC_URL_${kebabToSnakeCase(network)}`;
}

export function getExplorerApiKeyEnvVar<Net extends NetworkName>(
  network: Net,
): NetworkNameToExplorerApiKeyEnvVar<Net> {
  return `${kebabToSnakeCase(network)}_API_KEY`;
}

export function getExplorerApiKey(network: NetworkName): string | null {
  return getEnvStringNotAssert(network);
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
