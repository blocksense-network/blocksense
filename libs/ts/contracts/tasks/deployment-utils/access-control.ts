import { Artifacts, RunTaskFunction } from 'hardhat/types';
import { AbiCoder, Contract, solidityPacked } from 'ethers';

import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { ContractNames, NetworkConfig } from '../types';

export type Params = {
  config: NetworkConfig;
  deployData: ContractsConfigV2;
  adminMultisig: Safe;
  reporterMultisig?: Safe;
  run: RunTaskFunction;
  artifacts: Artifacts;
};

export async function setUpAccessControl({
  run,
  artifacts,
  config,
  deployData,
  adminMultisig,
  reporterMultisig,
}: Params) {
  const { deployer, deployerAddress, sequencerAddress } = config;

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

  const {
    OnlySequencerGuard__factory,
  } = require('@blocksense/contracts/typechain');

  const guard = OnlySequencerGuard__factory.connect(
    deployData.coreContracts.OnlySequencerGuard!.address,
    deployer,
  );
  if (reporterMultisig) {
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

  const reporterMultisigAddress = reporterMultisig
    ? await reporterMultisig.getAddress()
    : sequencerAddress;

  if (reporterMultisigAddress) {
    console.log(
      '\nSetting up access control and adding owners to admin multisig...',
    );

    const accessControl = new Contract(
      deployData.coreContracts.AccessControl.address,
      artifacts.readArtifactSync(ContractNames.AccessControl).abi,
      deployer,
    );

    const isAllowed = Boolean(
      Number(
        await deployer.call({
          to: accessControl.target.toString(),
          data: reporterMultisigAddress,
        }),
      ),
    );

    if (!isAllowed) {
      const safeTxSetAccessControl: SafeTransactionDataPartial = {
        to: accessControl.target.toString(),
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
  }

  const ownerBefore = await adminMultisig.getOwners();
  if (ownerBefore.length === 1 && config.adminMultisig.owners.length > 0) {
    const adminMultisigAddress = await adminMultisig.getAddress();
    for (const owner of config.adminMultisig.owners) {
      const safeTxAddOwner = await adminMultisig.createAddOwnerTx({
        ownerAddress: owner,
      });
      transactions.push(safeTxAddOwner.data);
    }

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
            [prevOwnerAddress, deployerAddress, config.adminMultisig.threshold],
          )
          .slice(2),
      operation: OperationType.Call,
    };
    transactions.push(safeTxRemoveOwner);
  }

  if (transactions.length > 0) {
    await run('multisig-tx-exec', {
      transactions,
      safe: adminMultisig,
      config,
    });

    if (ownerBefore.length === 1 && config.adminMultisig.owners.length > 0) {
      console.log(
        'Admin multisig owners changed to',
        await adminMultisig.getOwners(),
      );
      console.log('Removed signer from multisig owners');
      console.log('Current threshold', await adminMultisig.getThreshold());
    }
  }
  if (!reporterMultisig) {
    console.log(
      'Sequencer multisig not set up, skipping reporter multisig setup',
    );
    return;
  }

  console.log(
    '\nSetting up sequencer guard, adding reporters as owners and removing sequencer from owners...',
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
      .createEnableModuleTx(
        deployData.coreContracts.AdminExecutorModule!.address,
      )
      .then(tx => tx.data),

    ...config.reporterMultisig.owners.map(ownerAddress =>
      reporterMultisig
        .createAddOwnerTx({
          ownerAddress,
        })
        .then(tx => tx.data),
    ),

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
  ]);

  await run('multisig-tx-exec', {
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
