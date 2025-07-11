import { HexDataString } from '@blocksense/base-utils/buffer-and-hex';
import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { JsonRpcProvider, Network, Signer, Wallet } from 'ethers';

export interface MultisigConfig {
  owners: readonly EthereumAddress[];
  threshold: number;
}

export interface NetworkConfigBase {
  rpc: string;
  provider: JsonRpcProvider;
  deployer: Signer;
  deployerAddress: EthereumAddress;
  deployerIsLedger: boolean;
  network: Network;
  networkName: NetworkName;
  adfsUpgradeableProxySalt: HexDataString;
  sequencerAddress: EthereumAddress;
  reporterMultisig: MultisigConfig;
  deployWithReporterMultisig: boolean;
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

export type NetworkConfig = NetworkConfigBase &
  (
    | {
        deployerIsLedger: true;
        deployer: Signer;
      }
    | {
        deployerIsLedger: false;
        deployer: Wallet;
      }
  );

export enum ContractNames {
  ReporterMultisig = 'ReporterMultisig',
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
    ContractNames.AdminMultisig | ContractNames.ReporterMultisig
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
