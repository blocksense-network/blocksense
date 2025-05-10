import { HexDataString } from '@blocksense/base-utils/buffer-and-hex';
import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { JsonRpcProvider, Network, Signer, Wallet } from 'ethers';

export interface MultisigConfig {
  signer?: Wallet;
  owners: readonly EthereumAddress[];
  threshold: number;
}

interface NetworkConfigBase {
  rpc: string;
  provider: JsonRpcProvider;
  network: Network;
  networkName: NetworkName;
  adfsUpgradeableProxySalt: HexDataString;
  sequencerMultisig: MultisigConfig;
  deployWithSequencerMultisig: boolean;
  adminMultisig: MultisigConfig;
  feedIds: 'all' | readonly bigint[];
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
  AdminExecutorModule = 'AdminExecutorModule',
}

export type DeployContract = {
  name: Exclude<
    ContractNames,
    ContractNames.AdminMultisig | ContractNames.SequencerMultisig
  >;
  argsTypes: string[];
  argsValues: any[];
  salt: HexDataString;
  value: bigint;
  feedRegistryInfo?: {
    feedId: bigint;
    description: string;
    base: EthereumAddress | null;
    quote: EthereumAddress | null;
  };
};
