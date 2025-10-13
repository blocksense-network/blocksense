import { task } from 'hardhat/config';
import { solidityPacked } from 'ethers';
import Safe from '@safe-global/protocol-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';

import { isNetworkName } from '@blocksense/base-utils/evm';
import {
  color as c,
  drawBox,
  readline,
  renderTui,
  vlist,
} from '@blocksense/base-utils/tty';
import { readEvmDeployment } from '@blocksense/config-types/read-write-config';

import { NetworkConfig } from './types';
import { initChain } from './deployment-utils/init-chain';
import { executeMultisigTransaction } from './deployment-utils/multisig-tx-exec';

task('change-sequencer', 'Change sequencer role in Access Control contract')
  .addParam('networks', 'Network to deploy to')
  .addParam('sequencerAddress', 'Sequencer address')
  .addParam('setRole', 'Enable/Disable sequencer address role in AC')
  .setAction(async args => {
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(network));
    }

    for (const config of configs) {
      const { networkName } = config;
      const {
        contracts: {
          safe: { AdminMultisig },
          coreContracts: { AccessControl },
        },
      } = await readEvmDeployment(networkName, true);

      const signer = config.deployerIsLedger
        ? undefined
        : config.deployer.privateKey;

      const adminMultisig = await Safe.init({
        provider: config.rpc,
        signer,
        safeAddress: AdminMultisig,
        contractNetworks: {
          [config.network.chainId.toString()]: config.safeAddresses,
        },
      });

      const signers = await adminMultisig.getOwners();
      const threshold = await adminMultisig.getThreshold();

      renderTui(
        drawBox(
          'Change sequencer role in Access Control',
          drawBox(
            `ADMIN Multisig config`,
            c`Address: {bold ${AdminMultisig}}`,
            c`Threshold: {bold ${threshold} / ${signers.length}}`,
            `Signers: `,
            ...vlist(signers),
          ),
          drawBox(
            'Sequencer',
            `address: ${args.sequencerAddress}`,
            `is allowed: ${args.setRole ? '✅' : '❌'}`,
          ),
        ),
      );

      if ((await readline().question('\nConfirm deployment? (y/n) ')) !== 'y') {
        console.log('Aborting deployment...');
        return;
      }

      const safeTxSetAccessControl: SafeTransactionDataPartial = {
        to: AccessControl.address,
        value: '0',
        data: solidityPacked(
          ['address', 'bool'],
          [args.sequencerAddress, Boolean(JSON.parse(args.setRole))],
        ),
        operation: OperationType.Call,
      };

      await executeMultisigTransaction({
        transactions: [safeTxSetAccessControl],
        safe: adminMultisig,
        config,
      });
    }
  });
