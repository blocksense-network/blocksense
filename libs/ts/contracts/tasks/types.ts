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
  deployWithSequencerMultisig: boolean;
  deployReadAccessControl: boolean;
  readWhitelistAddresses: EthereumAddress[];
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
  ADFSReadAC = 'AggregatedDataFeedStoreReadAC',
  UpgradeableProxyADFS = 'UpgradeableProxyADFS',
  AccessControl = 'AccessControl',
  ReadAccessControl = 'ReadAccessControl',
  OnlySequencerGuard = 'OnlySequencerGuard',
}

export type DeployContract = {
  name: Exclude<
    ContractNames,
    ContractNames.AdminMultisig | ContractNames.SequencerMultisig
  >;
  duplicatedName?: Exclude<
    ContractNames,
    | ContractNames.AdminMultisig
    | ContractNames.SequencerMultisig
    | ContractNames.CLAggregatorAdapter
  >;
  argsTypes: string[];
  argsValues: any[];
  salt: string;
  value: bigint;
  feedRegistryInfo?: {
    description: string;
    base: EthereumAddress | null;
    quote: EthereumAddress | null;
  };
};
