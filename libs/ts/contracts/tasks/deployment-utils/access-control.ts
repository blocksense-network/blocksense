import { Artifacts, RunTaskFunction } from 'hardhat/types';
import { AbiCoder, Contract, solidityPacked } from 'ethers';

import { ContractsConfigV2 } from '@blocksense/config-types/evm-contracts-deployment';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { getEnvString, getOptionalEnvString } from '@blocksense/base-utils';
import { ContractNames, NetworkConfig } from '../types';

export type Params = {
  config: NetworkConfig;
  deployData: ContractsConfigV2;
  adminMultisig: Safe;
  sequencerMultisig?: Safe;
  run: RunTaskFunction;
  artifacts: Artifacts;
};

export async function setUpAccessControl({
  run,
  artifacts,
  config,
  deployData,
  adminMultisig,
  sequencerMultisig,
}: Params) {
  const adminSigner = config.adminMultisig.signer ?? config.ledgerAccount!;
  const sequencerSigner =
    config.sequencerMultisig.signer ?? config.ledgerAccount!;

  console.log('\nSetting sequencer role in sequencer guard...');

  const abiCoder = new AbiCoder();
  const transactions: SafeTransactionDataPartial[] = [];

  const guard = new Contract(
    deployData.coreContracts.OnlySequencerGuard!.address,
    artifacts.readArtifactSync(ContractNames.OnlySequencerGuard).abi,
    adminSigner,
  );
  if (sequencerMultisig) {
    const isSequencerSet = await guard.getSequencerRole(
      getEnvString('SEQUENCER_ADDRESS'),
    );

    if (!isSequencerSet) {
      const safeTxSetGuard: SafeTransactionDataPartial = {
        to: guard.target.toString(),
        value: '0',
        data: guard.interface.encodeFunctionData('setSequencer', [
          getEnvString('SEQUENCER_ADDRESS'), // sequencer address
          true,
        ]),
        operation: OperationType.Call,
      };
      transactions.push(safeTxSetGuard);
    } else {
      console.log('Sequencer guard already set up');
    }
  }

  const sequencerMultisigAddress = sequencerMultisig
    ? await sequencerMultisig.getAddress()
    : getOptionalEnvString('SEQUENCER_ADDRESS', '');
  if (sequencerMultisigAddress) {
    console.log(
      '\nSetting up access control and adding owners to admin multisig...',
    );

    const accessControl = new Contract(
      deployData.coreContracts.AccessControl.address,
      artifacts.readArtifactSync(ContractNames.AccessControl).abi,
      adminSigner,
    );

    const isAllowed = Boolean(
      Number(
        await sequencerSigner.call({
          to: accessControl.target.toString(),
          data: sequencerMultisigAddress,
        }),
      ),
    );

    if (!isAllowed) {
      const safeTxSetAccessControl: SafeTransactionDataPartial = {
        to: accessControl.target.toString(),
        value: '0',
        data: solidityPacked(
          ['address', 'bool'],
          [sequencerMultisigAddress, true],
        ),
        operation: OperationType.Call,
      };
      transactions.push(safeTxSetAccessControl);
    } else {
      console.log('Access control already set up');
    }
  }

  const owners = await adminMultisig.getOwners();
  if (owners.length === 1 && config.adminMultisig.owners.length > 0) {
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
            [
              prevOwnerAddress,
              await adminSigner.getAddress(),
              config.adminMultisig.threshold,
            ],
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

    if (owners.length === 1 && config.adminMultisig.owners.length > 0) {
      console.log(
        'Admin multisig owners changed to',
        await adminMultisig.getOwners(),
      );
      console.log('Removed signer from multisig owners');
      console.log('Current threshold', await adminMultisig.getThreshold());
    }
  }

  if (!!sequencerMultisig) {
    console.log(
      '\nSetting up sequencer guard, adding reporters as owners and removing sequencer from owners...',
    );

    const enabledGuard = await sequencerMultisig.getGuard();
    if (enabledGuard !== guard.target.toString()) {
      const sequencerMultisigAddress = await sequencerMultisig.getAddress();
      const sequencerTransactions: SafeTransactionDataPartial[] = [];

      const safeTxSetGuard = await sequencerMultisig.createEnableGuardTx(
        await guard.getAddress(),
      );
      sequencerTransactions.push(safeTxSetGuard.data);

      const safeTxSetModule = await sequencerMultisig.createEnableModuleTx(
        deployData.coreContracts.AdminExecutorModule!.address,
      );
      sequencerTransactions.push(safeTxSetModule.data);

      for (const owner of config.sequencerMultisig.owners) {
        const safeTxAddOwner = await sequencerMultisig.createAddOwnerTx({
          ownerAddress: owner,
        });
        sequencerTransactions.push(safeTxAddOwner.data);
      }

      const prevOwnerAddress = config.sequencerMultisig.owners[0];
      // removeOwner(address prevOwner, address owner, uint256 threshold);
      const safeTxRemoveOwner: SafeTransactionDataPartial = {
        to: sequencerMultisigAddress,
        value: '0',
        data:
          '0xf8dc5dd9' +
          abiCoder
            .encode(
              ['address', 'address', 'uint256'],
              [
                prevOwnerAddress,
                await sequencerSigner.getAddress(),
                config.sequencerMultisig.threshold,
              ],
            )
            .slice(2),
        operation: OperationType.Call,
      };
      sequencerTransactions.push(safeTxRemoveOwner);

      await run('multisig-tx-exec', {
        transactions: sequencerTransactions,
        safe: sequencerMultisig,
        config,
      });

      console.log('Only sequencer guard set');
      console.log(
        'Sequencer multisig owners changed to reporters',
        await sequencerMultisig.getOwners(),
      );
      console.log('Removed sequencer from multisig owners');
      console.log('Current threshold', await sequencerMultisig.getThreshold());
    } else {
      console.log('Sequencer guard already set up');
    }
  }
}
