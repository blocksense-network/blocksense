import { Schema as S } from 'effect';

import { Wallet, JsonRpcProvider, id } from 'ethers';
import { LedgerSigner } from '@ethers-ext/signer-ledger';
import HIDTransport from '@ledgerhq/hw-transport-node-hid';

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
  EthereumAddress,
} from '@blocksense/base-utils';

import {
  DeploymentEnvSchema,
  parseDeploymentEnvConfig,
  validateAndPrintDeploymentEnvConfig,
} from '@blocksense/base-utils/evm/functions';

import type { NetworkConfig } from '../types';

const sharedPerNetworkKind = {
  deployerAddressIsLedger: asVarSchema(S.BooleanFromString),
  deployerAddress: asVarSchema(ethereumAddress),
  deployerHDWalletDerivationPath: S.String,
  deployerPrivateKey: asVarSchema(hexDataString),

  adfsUpgradeableProxySalt: asVarSchema(hexDataString),

  adminMultisigThreshold: S.NumberFromString,
  adminMultisigOwners: fromCommaSeparatedString(asVarSchema(ethereumAddress)),

  sequencerAddress: asVarSchema(ethereumAddress),

  reporterMultisigEnable: asVarSchema(S.BooleanFromString),
  reporterMultisigThreshold: S.NumberFromString,
  reporterMultisigSigners: asVarSchema(
    fromCommaSeparatedString(asVarSchema(ethereumAddress)),
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
  // Allow the deployer private key to be empty if the deployer is a Ledger.
  if (parsedEnv.mergedConfig.deployerAddressIsLedger) {
    parsedEnv.mergedConfig.deployerPrivateKey ??= parseHexDataString('0x00');
  } else {
    parsedEnv.mergedConfig.deployerHDWalletDerivationPath = '';
  }
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

  let address: EthereumAddress;
  let deployer;

  if (envCfg.deployerAddressIsLedger) {
    const signer = new LedgerSigner(HIDTransport, provider).getSigner(
      envCfg.deployerHDWalletDerivationPath,
    );
    address = parseEthereumAddress(await signer.getAddress());
    if (address !== envCfg.deployerAddress) {
      throw new Error(
        `Deployer address mismatch: expected ${envCfg.deployerAddress}, got ${address}`,
      );
    }
    deployer = signer;
  } else {
    address = envCfg.deployerAddress;
    deployer = new Wallet(envCfg.deployerPrivateKey, provider);
  }

  return {
    deployerAddress: address,
    ...(envCfg.deployerAddressIsLedger
      ? {
          deployer: deployer as LedgerSigner,
          deployerIsLedger: true,
        }
      : {
          deployer: deployer as Wallet,
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
      '0xd921B42f7cBa1ab24d69b647129450Ba0cFcA797',
    ),
    multiSendCallOnlyAddress: parseEthereumAddress(
      '0x11c811009C6aFd2d1236F6512D5C5DBce6381b8a',
    ),
    createCallAddress: parseEthereumAddress(
      '0x5Bd97437eD741972aCc2ac46c3295E92425C9e06',
    ),
    safeSingletonAddress: parseEthereumAddress(
      '0xdAEcc4b9d2c62C391D135617Ffc6159DF99d576c',
    ),
    safeProxyFactoryAddress: parseEthereumAddress(
      '0x3f5e53cFdF49F54725Ea694D57607F435fb68c1F',
    ),
    fallbackHandlerAddress: parseEthereumAddress(
      '0x65D58E99Cb6574a5D0938fe20763c958455b0181',
    ),
    signMessageLibAddress: parseEthereumAddress(
      '0x14f03F7C9dC4e3eFdf62EA8E19bEdb0CdCc44F3f',
    ),
    simulateTxAccessorAddress: parseEthereumAddress(
      '0xC6d7F179BB3b8252e30edB5c317637071df0adBE',
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
