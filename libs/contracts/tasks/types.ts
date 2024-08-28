import { JsonRpcProvider, Network, Wallet } from 'ethers';

export interface NetworkConfig {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  signer: Wallet;
  owners: string[];
  safeAddresses: {
    multiSendAddress: string;
    multiSendCallOnlyAddress: string;
    createCallAddress: string;
    safeSingletonAddress: string;
    safeProxyFactoryAddress: string;
    fallbackHandlerAddress: string;
    signMessageLibAddress: string;
    simulateTxAccessorAddress: string;
  };
  threshold: number;
}

export interface ChainConfig {
  [chainId: string]: {
    name: string;
    contracts: ContractsConfig;
  };
}

type ContractData = {
  address: string;
  constructorArgs: any[];
};

export interface ContractsConfig {
  coreContracts: CoreContract;
  [ContractNames.ChainlinkProxy]: Array<ChainlinkProxyData>;
  [ContractNames.SafeMultisig]: string;
}

export type CoreContract = {
  [ContractNames.HistoricDataFeedStoreV2]: ContractData;
  [ContractNames.UpgradeableProxy]: ContractData;
  [ContractNames.FeedRegistry]: ContractData;
};

export interface ChainlinkProxyData {
  description: string;
  base: string;
  quote: string;
  address: string;
  constructorArgs: any[];
  chainlink_aggregator: string;
}

export enum ContractNames {
  SafeMultisig = 'SafeMultisig',
  FeedRegistry = 'FeedRegistry',
  ChainlinkProxy = 'ChainlinkProxy',
  HistoricDataFeedStoreV2 = 'HistoricDataFeedStoreV2',
  UpgradeableProxy = 'UpgradeableProxy',
}

export enum NetworkNames {
  buildbear = 'BUILD_BEAR',
  sepolia = 'ETH_SEPOLIA',
  holesky = 'ETH_HOLESKY',
  amoy = 'POLYGON_AMOY',
  manta = 'MANTA_SEPOLIA',
  fuji = 'AVAX_FUJI',
  chiado = 'GNOSIS_CHIADO',
  opSepolia = 'OPTIMISM_SEPOLIA',
  zkSyncSepolia = 'ZKSYNC_SEPOLIA',
  baseSepolia = 'BASE_SEPOLIA',
  specular = 'SPECULAR',
  scrollSepolia = 'SCROLL_SEPOLIA',
  arbSepolia = 'ARBITRUM_SEPOLIA',
  artio = 'BERA_ARTIO',
  hekla = 'TAIKO_HEKLA',
}
