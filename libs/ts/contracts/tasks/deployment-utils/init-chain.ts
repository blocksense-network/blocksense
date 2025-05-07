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
  asEnvSchema,
  hexDataString,
  isTestnet,
  networkName,
  DeploymentEnvSchema,
  parseDeploymentEnvConfig,
} from '@blocksense/base-utils';

import type {
  NetworkConfig,
  NetworkConfigBase,
  NetworkConfigWithLedger,
  NetworkConfigWithoutLedger,
} from '../types';

const envSchema = {
  shared: {
    NETWORKS: fromCommaSeparatedString(networkName),
  },

  mainnet: {
    LEDGER_ACCOUNT: S.UndefinedOr(ethereumAddress),
    ADFS_UPGRADEABLE_PROXY_SALT_MAINNET: S.UndefinedOr(hexDataString),
  },

  testnet: {
    ADMIN_SIGNER_PRIVATE_KEY: S.UndefinedOr(hexDataString),
    ADFS_UPGRADEABLE_PROXY_SALT_TESTNET: S.UndefinedOr(hexDataString),
  },

  perNetwork: {
    RPC_URL: S.URL,

    ADMIN_THRESHOLD: S.NumberFromString,
    ADMIN_EXTRA_SIGNERS: fromCommaSeparatedString(ethereumAddress),
    DEPLOY_WITH_SEQUENCER_MULTISIG: asEnvSchema(S.BooleanFromString),
    SEQUENCER_ADDRESS: ethereumAddress,
    REPORTER_THRESHOLD: S.NumberFromString,
    REPORTER_ADDRESSES: fromCommaSeparatedString(ethereumAddress),
    FEED_IDS: S.Union(S.Literal('all'), fromCommaSeparatedString(S.BigInt)),
  },
} satisfies DeploymentEnvSchema;

export async function initChain(
  ethers: typeof _ethers & HardhatEthersHelpers,
  networkName: NetworkName,
): Promise<NetworkConfig> {
  const envConfig = parseDeploymentEnvConfig(envSchema, networkName);

  const rpc = envConfig.perNetwork.RPC_URL.toString();
  const provider = new JsonRpcProvider(rpc);
  const network = await withTimeout(
    () => provider.getNetwork(),
    5000,
    new Error(`Failed to connect to network: '${rpc}'`),
  );

  const adfsUpgradeableProxySalt = isTestnet(networkName)
    ? envConfig.testnet.ADFS_UPGRADEABLE_PROXY_SALT_TESTNET
    : envConfig.mainnet.ADFS_UPGRADEABLE_PROXY_SALT_MAINNET;

  const baseConfig: NetworkConfigBase = {
    rpc,
    provider,
    network,
    networkName,
    adfsUpgradeableProxySalt:
      adfsUpgradeableProxySalt ?? ethers.id('upgradeableProxy'),
    sequencerMultisig: {
      owners: envConfig.perNetwork.REPORTER_ADDRESSES,
      threshold: envConfig.perNetwork.REPORTER_THRESHOLD,
    },
    deployWithSequencerMultisig:
      envConfig.perNetwork.DEPLOY_WITH_SEQUENCER_MULTISIG,
    adminMultisig: {
      owners: envConfig.perNetwork.ADMIN_EXTRA_SIGNERS,
      threshold: envConfig.perNetwork.ADMIN_THRESHOLD,
    },
    feedIds: envConfig.perNetwork.FEED_IDS,
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

  if (isTestnet(networkName)) {
    const admin = new Wallet(
      envConfig.testnet.ADMIN_SIGNER_PRIVATE_KEY,
      provider,
    );
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
  } else {
    const ledgerAccount = await ethers.getSigner(
      envConfig.mainnet.LEDGER_ACCOUNT,
    );
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
  }
}
