import assert from 'node:assert';

import { task } from 'hardhat/config';
import { Network, Signer, Wallet } from 'ethers';

import {
  isNetworkName,
  getRpcUrl,
  kebabToScreamingSnakeCase,
  parseEthereumAddress,
  getOptionalEnvString,
  getEnvString,
} from '@blocksense/base-utils';

import { awaitTimeout } from '../utils';
import { NetworkConfig } from '../types';

task('init-chain', '[UTILS] Init chain configuration').setAction(
  async ({ networkName }, { ethers }) => {
    assert(isNetworkName(networkName), `Invalid network name: ${networkName}`);
    const rpc = getRpcUrl(networkName);
    const provider = new ethers.JsonRpcProvider(rpc);

    let network: Network | undefined;
    try {
      network = await Promise.race([
        provider.getNetwork(),
        awaitTimeout(5000, 'provider.getNetwork() timed out after 5 seconds'),
      ]);

      if (!network) {
        throw new Error(`Network not initialized`);
      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }

    const envSequencerOwners =
      process.env[
        'REPORTER_ADDRESSES_' + kebabToScreamingSnakeCase(networkName)
      ];
    const sequencerOwners = envSequencerOwners
      ? envSequencerOwners
          .split(',')
          .map(address => parseEthereumAddress(address))
      : [];

    const envAdminOwners =
      process.env[
        'ADMIN_EXTRA_SIGNERS_' + kebabToScreamingSnakeCase(networkName)
      ];
    const adminOwners = envAdminOwners
      ? envAdminOwners.split(',').map(address => parseEthereumAddress(address))
      : [];

    const deploySequencerMultisig = JSON.parse(
      getOptionalEnvString(
        'DEPLOY_WITH_SEQUENCER_MULTISIG_' +
          kebabToScreamingSnakeCase(networkName),
        'true',
      ),
    );

    let ledgerAccount: Signer | undefined;
    let admin: Wallet | undefined;

    const ledgerAccountAddress = getOptionalEnvString('LEDGER_ACCOUNT', '');
    if (ledgerAccountAddress) {
      ledgerAccount = await ethers.getSigner(ledgerAccountAddress);
    } else {
      admin = new Wallet(getEnvString('ADMIN_SIGNER_PRIVATE_KEY'), provider);
    }

    const feedIds = getOptionalEnvString(
      'FEED_IDS_' + kebabToScreamingSnakeCase(networkName),
      '',
    );

    return {
      rpc,
      provider,
      network,
      networkName,
      sequencerMultisig: {
        signer: admin,
        owners: sequencerOwners,
        threshold: +getOptionalEnvString('REPORTER_THRESHOLD', '1'),
      },
      deployWithSequencerMultisig: deploySequencerMultisig,
      adminMultisig: {
        signer: admin,
        owners: adminOwners,
        threshold: +getOptionalEnvString('ADMIN_THRESHOLD', '1'),
      },
      ledgerAccount,
      feedIds: feedIds ? feedIds.split(',').map(id => +id) : undefined,
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
    } as NetworkConfig;
  },
);
