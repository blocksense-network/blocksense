import { Schema as S } from 'effect';

import type { ethers as _ethers } from 'ethers';
import { Wallet, JsonRpcProvider } from 'ethers';
import type { HardhatEthersHelpers } from '@nomicfoundation/hardhat-ethers/types';

import {
  withTimeout,
  parseEthereumAddress,
  NetworkName,
  fromCommaSeparatedString,
  ethereumAddress,
  asVarSchema,
  hexDataString,
  networkName,
  DeploymentEnvSchema,
  parseDeploymentEnvConfig,
  validateAndPrintDeploymentEnvConfig,
} from '@blocksense/base-utils';

import type {
  NetworkConfig,
  NetworkConfigBase,
  NetworkConfigWithLedger,
  NetworkConfigWithoutLedger,
} from '../types';

const sharedPerNetworkKind = {
  deployerAddressIsLedger: asVarSchema(S.BooleanFromString),
  deployerAddress: ethereumAddress,
  deployerPrivateKey: hexDataString,

  adfsUpgradeableProxySalt: asVarSchema(hexDataString),

  adminMultisigThreshold: S.NumberFromString,
  adminMultisigOwners: fromCommaSeparatedString(ethereumAddress),

  sequencerAddress: ethereumAddress,

  reporterMultisigEnable: asVarSchema(S.BooleanFromString),
  reporterMultisigThreshold: S.NumberFromString,
  reporterMultisigSigners: asVarSchema(
    fromCommaSeparatedString(ethereumAddress),
  ),
};

const envSchema = {
  global: {
    NETWORKS: fromCommaSeparatedString(networkName),
  },

  perNetworkKind: sharedPerNetworkKind,

  perNetworkName: {
    rpcUrl: S.URL,
    feedIds: S.Union(S.Literal('all'), fromCommaSeparatedString(S.BigInt)),

    ...sharedPerNetworkKind,
  },
} satisfies DeploymentEnvSchema;

export async function initChain(
  ethers: typeof _ethers & HardhatEthersHelpers,
  networkName: NetworkName,
): Promise<NetworkConfig> {
  const parsedEnv = parseDeploymentEnvConfig(
    envSchema,
    networkName,
    process.env,
  );

  const parsedConfig = validateAndPrintDeploymentEnvConfig(parsedEnv);

  const {
    rpcUrl,
    feedIds,

    deployerAddress,
    deployerAddressIsLedger,
    deployerPrivateKey,

    adfsUpgradeableProxySalt,

    reporterMultisigEnable,
    reporterMultisigSigners,
    reporterMultisigThreshold,

    adminMultisigOwners,
    adminMultisigThreshold,
  } = parsedConfig.mergedConfig;

  const rpc = rpcUrl.toString();
  const provider = new JsonRpcProvider(rpc);
  const network = await withTimeout(
    () => provider.getNetwork(),
    5000,
    new Error(`Failed to connect to network: '${rpc}'`),
  );

  const baseConfig: NetworkConfigBase = {
    rpc,
    provider,
    network,
    networkName,
    adfsUpgradeableProxySalt,

    deployWithSequencerMultisig: reporterMultisigEnable,

    sequencerMultisig: {
      owners: reporterMultisigSigners,
      threshold: reporterMultisigThreshold,
    },
    adminMultisig: {
      owners: adminMultisigOwners,
      threshold: adminMultisigThreshold,
    },
    feedIds,
    safeAddresses: {
      multiSendAddress: parseEthereumAddress(
        '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
      ),
      multiSendCallOnlyAddress: parseEthereumAddress(
        '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
      ),
      createCallAddress: parseEthereumAddress(
        '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
      ),
      safeSingletonAddress: parseEthereumAddress(
        '0x41675C099F32341bf84BFc5382aF534df5C7461a',
      ),
      safeProxyFactoryAddress: parseEthereumAddress(
        '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
      ),
      fallbackHandlerAddress: parseEthereumAddress(
        '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
      ),
      signMessageLibAddress: parseEthereumAddress(
        '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
      ),
      simulateTxAccessorAddress: parseEthereumAddress(
        '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
      ),
      safeWebAuthnSharedSignerAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-shared-signer.json#L6gs
        '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
      ),
      safeWebAuthnSignerFactoryAddress: parseEthereumAddress(
        // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-signer-factory.json#L6
        '0x1d31F259eE307358a26dFb23EB365939E8641195',
      ),
    },
  };

  if (deployerAddressIsLedger) {
    const ledgerAccount = await ethers.getSigner(deployerAddress);
    const config: NetworkConfigWithLedger = {
      ...baseConfig,
      ledgerAccount,
      sequencerMultisig: {
        ...baseConfig.sequencerMultisig,
        signer: undefined,
      },
      adminMultisig: {
        ...baseConfig.adminMultisig,
        signer: undefined,
      },
    };
    return config;
  } else {
    const admin = new Wallet(deployerPrivateKey, provider);
    const config: NetworkConfigWithoutLedger = {
      ...baseConfig,
      sequencerMultisig: {
        ...baseConfig.sequencerMultisig,
        signer: admin,
      },
      adminMultisig: {
        ...baseConfig.adminMultisig,
        signer: admin,
      },
    };
    return config;
  }
}
