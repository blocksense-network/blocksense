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
    safeWebAuthnSharedSignerAddress: EthereumAddress;
    safeWebAuthnSignerFactoryAddress: EthereumAddress;
  };
  threshold: number;
}

export enum ContractNames {
  SafeMultisig = 'SafeMultisig',
  CLFeedRegistryAdapter = 'CLFeedRegistryAdapter',
  CLAggregatorAdapter = 'CLAggregatorAdapter',
  HistoricalDataFeedStoreV2 = 'HistoricalDataFeedStoreV2',
  UpgradeableProxy = 'UpgradeableProxy',
}
