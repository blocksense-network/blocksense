import { isNetworkName } from '@blocksense/base-utils';
import { task } from 'hardhat/config';
import { NetworkConfig } from './types';
import Safe, { SigningMethod } from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import {
  OperationType,
  SafeTransactionDataPartial,
} from '@safe-global/safe-core-sdk-types';
import { adjustVInSignature } from '@safe-global/protocol-kit/dist/src/utils';
import { readEvmDeployment } from '@blocksense/config-types';
import { initChain } from './deployment-utils/init-chain';

task('change-sequencer', 'Change sequencer role in Access Control contract')
  .addParam('networks', 'Network to deploy to')
  .addParam('sequencerAddress', 'Sequencer address')
  .addParam('setRole', 'Enable/Disable sequencer address role in AC')
  .setAction(async (args, { ethers }) => {
    console.log('args', args);
    const networks = args.networks.split(',');
    const configs: NetworkConfig[] = [];
    for (const network of networks) {
      if (!isNetworkName(network)) {
        throw new Error(`Invalid network: ${network}`);
      }
      configs.push(await initChain(ethers, network));
    }

    for (const config of configs) {
      const { networkName } = config;
      const {
        contracts: {
          AdminMultisig,
          coreContracts: { AccessControl },
        },
      } = await readEvmDeployment(networkName, true);

      const adminMultisig = await Safe.init({
        provider: config.rpc,
        signer: config.adminMultisig.signer?.privateKey,
        safeAddress: AdminMultisig,
        contractNetworks: {
          [config.network.chainId.toString()]: config.safeAddresses,
        },
      });

      // Initialize the API Kit
      const apiKit = new SafeApiKit({
        chainId: config.network.chainId,
      });

      const safeTxSetAccessControl: SafeTransactionDataPartial = {
        to: AccessControl.address,
        value: '0',
        data: ethers.solidityPacked(
          ['address', 'bool'],
          [args.sequencerAddress, Boolean(JSON.parse(args.setRole))],
        ),
        operation: OperationType.Call,
      };

      const tx = await adminMultisig.createTransaction({
        transactions: [safeTxSetAccessControl],
      });

      const safeTxHash = await adminMultisig.getTransactionHash(tx);

      const signer = config.adminMultisig.signer || config.ledgerAccount!;

      const typedDataHash = ethers.toBeArray(safeTxHash);
      const signedData = await signer.signMessage(typedDataHash);
      const signature = await adjustVInSignature(
        SigningMethod.ETH_SIGN,
        signedData,
        safeTxHash,
        await signer.getAddress(),
      );

      // Send the transaction to the Transaction Service with the signature from Owner A
      await apiKit.proposeTransaction({
        safeAddress: AdminMultisig,
        safeTransactionData: tx.data,
        safeTxHash,
        senderAddress: await signer.getAddress(),
        senderSignature: signature,
      });
    }
  });
