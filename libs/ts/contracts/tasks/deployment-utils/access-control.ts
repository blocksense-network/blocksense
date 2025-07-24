import { Artifacts } from 'hardhat/types';
import { AbiCoder, solidityPacked } from 'ethers';

import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { assertNotNull, EthereumAddress } from '@blocksense/base-utils';

import { NetworkConfig } from '../types';
import { executeMultisigTransaction } from './multisig-tx-exec';

export type Params = {
  config: NetworkConfig;
  deployData: ContractsConfigV2;
  adminMultisig: Safe;
  reporterMultisig?: Safe;
  artifacts: Artifacts;
};

export async function setUpAccessControl({
  artifacts,
  config,
  deployData,
  adminMultisig,
  reporterMultisig,
}: Params) {
  const { deployer, deployerAddress, sequencerAddress } = config;
  const {
    OnlySequencerGuard__factory,
  } = require('@blocksense/contracts/typechain');

  console.log('\nSetting sequencer role in sequencer guard...');
  console.log(`Sequencer address: ${sequencerAddress}`);
  console.log(`Admin multisig address: ${await adminMultisig.getAddress()}`);
  console.log(
    `Reporter multisig address: ${
      reporterMultisig ? await reporterMultisig.getAddress() : 'none'
    }`,
  );

  const abiCoder = new AbiCoder();
  const transactions: SafeTransactionDataPartial[] = [];

  if (reporterMultisig) {
    const guard = OnlySequencerGuard__factory.connect(
      deployData.safe.OnlySequencerGuard!.address,
      deployer,
    );

    console.log('\nSetting sequencer address in guard...');

    const isSequencerSet = await guard.getSequencerRole(sequencerAddress);
    if (!isSequencerSet) {
      const safeTxSetGuard: SafeTransactionDataPartial = {
        to: guard.target.toString(),
        value: '0',
        data: guard.interface.encodeFunctionData('setSequencer', [
          sequencerAddress,
          true,
        ]),
        operation: OperationType.Call,
      };
      transactions.push(safeTxSetGuard);
    } else {
      console.log('Sequencer guard already set up');
    }
  }

  let reporterMultisigAddress: EthereumAddress;

  if (!reporterMultisig) {
    console.log(
      `Reporter multisig not set up, using sequencer address ${sequencerAddress} for access control`,
    );
    reporterMultisigAddress = sequencerAddress;
  } else {
    reporterMultisigAddress =
      (await reporterMultisig.getAddress()) as EthereumAddress;
    console.log(
      `Reporter multisig set up, using reporter multisig address ${reporterMultisigAddress} for access control`,
    );
  }

  const accessControlAddress = deployData.coreContracts.AccessControl.address;

  const isAllowed = Boolean(
    Number(
      await deployer.call({
        to: accessControlAddress,
        data: reporterMultisigAddress,
      }),
    ),
  );

  if (!isAllowed) {
    const safeTxSetAccessControl: SafeTransactionDataPartial = {
      to: accessControlAddress,
      value: '0',
      data: solidityPacked(
        ['address', 'bool'],
        [reporterMultisigAddress, true],
      ),
      operation: OperationType.Call,
    };
    transactions.push(safeTxSetAccessControl);
  } else {
    console.log('Access control already set up');
  }

  const ownersBeforeAdminMultisig = await adminMultisig.getOwners();
  if (
    ownersBeforeAdminMultisig.length === 1 &&
    config.adminMultisig.owners.length > 0
  ) {
    const adminMultisigAddress = await adminMultisig.getAddress();
    for (const owner of config.adminMultisig.owners) {
      if (ownersBeforeAdminMultisig.includes(owner)) {
        console.log(owner + ' is already an owner');
        continue;
      }
      const safeTxAddOwner = await adminMultisig.createAddOwnerTx({
        ownerAddress: owner,
      });
      transactions.push(safeTxAddOwner.data);
    }
    if (!config.adminMultisig.owners.includes(deployerAddress)) {
      console.log('Removing deployer from owners');
      const prevOwnerAddress = config.adminMultisig.owners[0];
      // removeOwner(address prevOwner, address owner, uint256 threshold);
      const safeTxRemoveOwner: SafeTransactionDataPartial = {
        to: adminMultisigAddress,
        value: '0',
        data:
          '0xf8dc5dd9' +
          abiCoder
            .encode(
              ['address', 'address', 'uint256'],
              [
                prevOwnerAddress,
                deployerAddress,
                config.adminMultisig.threshold,
              ],
            )
            .slice(2),
        operation: OperationType.Call,
      };
      transactions.push(safeTxRemoveOwner);
    }
  }

  if (transactions.length > 0) {
    await executeMultisigTransaction({
      transactions,
      safe: adminMultisig,
      config,
    });

    if (
      ownersBeforeAdminMultisig.length === 1 &&
      config.adminMultisig.owners.length > 0
    ) {
      console.log(
        'Admin multisig owners changed to',
        await adminMultisig.getOwners(),
      );
      console.log('Current threshold', await adminMultisig.getThreshold());
    }
  }

  if (!reporterMultisig) {
    console.log(
      'Reporter multisig not set up, skipping reporter multisig setup',
    );
    return;
  }

  const guard = OnlySequencerGuard__factory.connect(
    assertNotNull(
      deployData.safe.OnlySequencerGuard,
      'OnlySequencerGuard is not specified in the deployment data',
    ).address,
    deployer,
  );

  const enabledGuard = await reporterMultisig.getGuard();
  if (enabledGuard === guard.target.toString()) {
    console.log('Sequencer guard already set up');
    return;
  }

  const reporterMultisigTxs: SafeTransactionDataPartial[] = await Promise.all([
    reporterMultisig
      .createEnableGuardTx(await guard.getAddress())
      .then(tx => tx.data),

    reporterMultisig
      .createEnableModuleTx(deployData.safe.AdminExecutorModule!.address)
      .then(tx => tx.data),

    ...config.reporterMultisig.owners
      .filter(o => o != deployerAddress)
      .map(ownerAddress =>
        reporterMultisig
          .createAddOwnerTx({
            ownerAddress,
          })
          .then(tx => tx.data),
      ),

    ...(!config.reporterMultisig.owners.includes(deployerAddress)
      ? [
          {
            to: reporterMultisigAddress,
            value: '0',
            // removeOwner(address prevOwner, address owner, uint256 threshold);
            data:
              '0xf8dc5dd9' +
              abiCoder
                .encode(
                  ['address', 'address', 'uint256'],
                  [
                    config.reporterMultisig.owners[0],
                    deployerAddress,
                    config.reporterMultisig.threshold,
                  ],
                )
                .slice(2),
            operation: OperationType.Call,
          },
        ]
      : []),
  ]);

  console.log(
    'Enabling reporter multisig guard and admin executor module, adding owners and removing deployer from owners',
  );

  await executeMultisigTransaction({
    transactions: reporterMultisigTxs,
    safe: reporterMultisig,
    config,
  });

  console.log('Only sequencer guard set');
  console.log(
    'Reporter multisig owners changed to reporters',
    await reporterMultisig.getOwners(),
  );
  console.log('Removed sequencer from multisig owners');
  console.log('Current threshold', await reporterMultisig.getThreshold());
}
