import { EthereumAddress } from '@blocksense/base-utils/evm';
import { JsonRpcProvider, Network, Wallet } from 'ethers';

export interface NetworkConfig {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  signer: Wallet;
  owners: EthereumAddress[];
  safeAddresses: {
    multiSendAddress: EthereumAddress;
    multiSendCallOnlyAddress: EthereumAddress;
    createCallAddress: EthereumAddress;
    safeSingletonAddress: EthereumAddress;
    safeProxyFactoryAddress: EthereumAddress;
    fallbackHandlerAddress: EthereumAddress;
    signMessageLibAddress: EthereumAddress;
    simulateTxAccessorAddress: EthereumAddress;
  };
  threshold: number;
}

export enum ContractNames {
  SafeMultisig = 'SafeMultisig',
  FeedRegistry = 'FeedRegistry',
  ChainlinkProxy = 'ChainlinkProxy',
  HistoricDataFeedStoreV2 = 'HistoricDataFeedStoreV2',
  UpgradeableProxy = 'UpgradeableProxy',
}
