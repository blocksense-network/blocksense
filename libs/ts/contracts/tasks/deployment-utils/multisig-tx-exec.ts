import { task } from 'hardhat/config';
import { parseTxHash } from '@blocksense/base-utils';
import Safe, {
  SigningMethod,
  EthSafeSignature,
} from '@safe-global/protocol-kit';
import {
  calculateSafeTransactionHash,
  adjustVInSignature,
} from '@safe-global/protocol-kit/dist/src/utils';
import {
  SafeTransaction,
  SafeTransactionDataPartial,
  TransactionOptions,
} from '@safe-global/safe-core-sdk-types';
import { NetworkConfig } from '../types';
import { TransactionResponse } from 'ethers';

task('multisig-tx-exec', '[UTILS] Execute multisig transactions').setAction(
  async (args, { ethers }) => {
    const {
      transactions,
      safe,
      config,
    }: {
      transactions: SafeTransactionDataPartial[] | SafeTransaction;
      safe: Safe;
      config: NetworkConfig;
    } = args;

    let tx: SafeTransaction;

    if (Array.isArray(transactions)) {
      if (transactions.length === 0) {
        console.log('No transactions to execute');
        return;
      }
      tx = await safe.createTransaction({
        transactions,
      });
    } else {
      tx = transactions;
    }

    if (config.adminMultisig.signer) {
      console.log('\nProposing transaction...');

      const txResponse = await safe.executeTransaction(tx);
      const transaction = await config.provider.getTransaction(txResponse.hash);
      await transaction?.wait();

      console.log('-> tx hash', txResponse.hash);
      return parseTxHash(txResponse.hash);
    }

    const message = calculateSafeTransactionHash(
      await safe.getAddress(),
      tx.data,
      safe.getContractVersion(),
      await safe.getChainId(),
    );
    const ledgerAddress = await config.ledgerAccount!.getAddress();
    const signedMessage = await config.ledgerAccount!.signMessage!(
      ethers.toBeArray(message),
    );
    const signature = await adjustVInSignature(
      SigningMethod.ETH_SIGN,
      signedMessage,
      message,
      ledgerAddress,
    );
    tx.addSignature(new EthSafeSignature(ledgerAddress, signature));

    console.log('\nProposing transaction...');

    const txResponse = await executeTransaction(tx, safe, config, {
      nonce: await config.provider.getTransactionCount(
        await config.ledgerAccount!.getAddress(),
      ),
    });

    const transaction = await config.provider.getTransaction(txResponse.hash);
    await transaction?.wait();
    console.log('-> tx hash', txResponse.hash);
    return parseTxHash(txResponse.hash);
  },
);

const executeTransaction = async (
  safeTransaction: SafeTransaction,
  safe: Safe,
  config: NetworkConfig,
  options?: TransactionOptions,
): Promise<TransactionResponse> => {
  const args = [
    safeTransaction.data.to,
    BigInt(safeTransaction.data.value),
    safeTransaction.data.data,
    safeTransaction.data.operation,
    BigInt(safeTransaction.data.safeTxGas),
    BigInt(safeTransaction.data.baseGas),
    BigInt(safeTransaction.data.gasPrice),
    safeTransaction.data.gasToken,
    safeTransaction.data.refundReceiver,
    safeTransaction.encodedSignatures(),
  ];

  const safeContract = safe.getContractManager().safeContract;

  if (!safeContract) {
    throw new Error('Safe contract not found');
  }

  const contractData: any = (safeContract.encode as any)('execTransaction');
  return config.ledgerAccount!.sendTransaction({
    to: safeContract.getAddress(),
    value: 0,
    data: contractData,
  });
};
