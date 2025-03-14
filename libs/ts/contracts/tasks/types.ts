import { EthereumAddress } from '@blocksense/base-utils/evm';
import { JsonRpcProvider, Network, Signer, Wallet } from 'ethers';

export interface MultisigConfig {
  signer?: Wallet;
  owners: EthereumAddress[];
  threshold: number;
}

interface NetworkConfigBase {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  sequencerMultisig: MultisigConfig;
  deployWithSequencerMultisig: boolean;
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

interface NetworkConfigWithLedger extends NetworkConfigBase {
  ledgerAccount: Signer;
  sequencerMultisig: Omit<MultisigConfig, 'signer'> & { signer?: undefined };
  adminMultisig: Omit<MultisigConfig, 'signer'> & { signer?: undefined };
}

interface NetworkConfigWithoutLedger extends NetworkConfigBase {
  ledgerAccount?: undefined;
  sequencerMultisig: MultisigConfig;
  adminMultisig: MultisigConfig;
}

export type NetworkConfig =
  | NetworkConfigWithLedger
  | NetworkConfigWithoutLedger;

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

export type DeployContract = {
  name: Exclude<
    ContractNames,
    ContractNames.AdminMultisig | ContractNames.SequencerMultisig
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
