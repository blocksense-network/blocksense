import { Schema as S } from 'effect';

import { type ethers as EthersType, Wallet, JsonRpcProvider, id } from 'ethers';
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
  parseHexDataString,
} from '@blocksense/base-utils';

import {
  DeploymentEnvSchema,
  parseDeploymentEnvConfig,
  validateAndPrintDeploymentEnvConfig,
} from '@blocksense/base-utils/evm/functions';

import type { NetworkConfig } from '../types';

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

  isSafeOriginalDeployment: asVarSchema(S.BooleanFromString),
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
  ethers: typeof EthersType & HardhatEthersHelpers,
  networkName: NetworkName,
): Promise<NetworkConfig> {
  const parsedEnv = parseDeploymentEnvConfig(envSchema, networkName);

  parsedEnv.mergedConfig.adfsUpgradeableProxySalt ??= parseHexDataString(
    // When the deployer address is the default Hardhat address,
    // use custom UpgradeableProxy CREATE2 salt, such that the
    // UpgradeableProxy address starts with '0xADF5a...',
    // otherwise, use the default salt:
    parsedEnv.mergedConfig.deployerAddress ===
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
      ? '0xf8f3965692216a43513fd1ea951d2b3c9d48fac5a96a95a159ce854886f7c1bd'
      : id('upgradeableProxy'),
  );
  parsedEnv.mergedConfig.isSafeOriginalDeployment ??= true;

  const { mergedConfig: envCfg } =
    validateAndPrintDeploymentEnvConfig(parsedEnv);

  const rpc = envCfg.rpcUrl.toString();
  const provider = new JsonRpcProvider(rpc);
  const network = await withTimeout(
    () => provider.getNetwork(),
    5000,
    new Error(`Failed to connect to network: '${rpc}'`),
  );

  const safeAddresses = getSafeAddresses(
    parsedEnv.mergedConfig.isSafeOriginalDeployment,
  );

  return {
    deployerAddress: envCfg.deployerAddress,
    ...(envCfg.deployerAddressIsLedger
      ? {
          deployer: await ethers.getSigner(envCfg.deployerAddress),
          deployerIsLedger: true,
        }
      : {
          deployer: new Wallet(envCfg.deployerPrivateKey, provider),
          deployerIsLedger: false,
        }),

    rpc,
    provider,
    network,
    networkName,
    adfsUpgradeableProxySalt: envCfg.adfsUpgradeableProxySalt,

    sequencerAddress: envCfg.sequencerAddress,

    deployWithReporterMultisig: envCfg.reporterMultisigEnable,

    reporterMultisig: {
      owners: envCfg.reporterMultisigSigners,
      threshold: envCfg.reporterMultisigThreshold,
    },
    adminMultisig: {
      owners: envCfg.adminMultisigOwners,
      threshold: envCfg.adminMultisigThreshold,
    },
    feedIds: envCfg.feedIds,
    safeAddresses,
  } satisfies NetworkConfig;
}

function getSafeAddresses(isOriginalDeployment: boolean) {
  if (isOriginalDeployment) {
    return {
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
    };
  }

  return {
    multiSendAddress: parseEthereumAddress(
      '0xf603AA036D2Fe648F0b8ee51b601e773f4096bf1',
    ),
    multiSendCallOnlyAddress: parseEthereumAddress(
      '0xe11820360fc41fC7703483CA7933997f682477A9',
    ),
    createCallAddress: parseEthereumAddress(
      '0xA0643A04FAb7f11D9dfd79A22a5D35255109E885',
    ),
    safeSingletonAddress: parseEthereumAddress(
      '0xe2D17cEeA58B60101a87cA032689fb0d6DC84aEB',
    ),
    safeProxyFactoryAddress: parseEthereumAddress(
      '0xEF3C826145BD136fcad6e66EdB563DBFB92E9a3E',
    ),
    fallbackHandlerAddress: parseEthereumAddress(
      '0xc2D3f66D9EA20D1e692Be21A82F187ae31d0Ad62',
    ),
    signMessageLibAddress: parseEthereumAddress(
      '0x7a31fad5268d0AbC79CFaD12177747D5d656d4d2',
    ),
    simulateTxAccessorAddress: parseEthereumAddress(
      '0x68F58CFBF5153128E8F5d9756761F89C3dd18D2E',
    ),
    safeWebAuthnSharedSignerAddress: parseEthereumAddress(
      // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-shared-signer.json#L6gs
      '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
    ),
    safeWebAuthnSignerFactoryAddress: parseEthereumAddress(
      // https://github.com/safe-global/safe-modules-deployments/blob/v2.2.4/src/assets/safe-passkey-module/v0.2.1/safe-webauthn-signer-factory.json#L6
      '0x1d31F259eE307358a26dFb23EB365939E8641195',
    ),
  };
}
