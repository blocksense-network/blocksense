import { EthereumAddress } from '@blocksense/base-utils/evm';
import { JsonRpcProvider, Network, Wallet } from 'ethers';

export interface MultisigConfig {
  signer: Wallet;
  owners: EthereumAddress[];
  threshold: number;
}

export interface NetworkConfig {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  sequencerMultisig: MultisigConfig;
  adminMultisig: MultisigConfig;
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
}

export enum ContractNames {
  SequencerMultisig = 'SequencerMultisig',
  AdminMultisig = 'AdminMultisig',
  CLFeedRegistryAdapter = 'CLFeedRegistryAdapter',
  CLAggregatorAdapter = 'CLAggregatorAdapter',
  ADFS = 'AggregatedDataFeedStore',
  UpgradeableProxyADFS = 'UpgradeableProxyADFS',
  AccessControl = 'AccessControl',
  OnlySequencerGuard = 'OnlySequencerGuard',
}
