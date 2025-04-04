import { task } from 'hardhat/config';

import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import Safe, {
  SigningMethod,
  EthSafeSignature,
} from '@safe-global/protocol-kit';
import {
  calculateSafeTransactionHash,
  adjustVInSignature,
} from '@safe-global/protocol-kit/dist/src/utils';

import { assertNotNull } from '@blocksense/base-utils';

import type { NetworkConfig } from '../types';

type Params = {
  transactions: SafeTransactionDataPartial[];
  safe: Safe;
  config: NetworkConfig;
};

task('multisig-tx-exec', '[UTILS] Execute multisig transactions').setAction(
  async ({ transactions, safe, config }: Params, { ethers }) => {
    const tx = await safe.createTransaction({
      transactions,
    });

    if (config.adminMultisig.signer) {
      console.log('\nProposing transaction...');

      const txResponse = await safe.executeTransaction(tx);
      const transaction = await config.provider.getTransaction(txResponse.hash);
      await transaction?.wait();

      console.log('-> tx hash', txResponse.hash);
      return txResponse.hash;
    }

    const message = calculateSafeTransactionHash(
      await safe.getAddress(),
      tx.data,
      safe.getContractVersion(),
      await safe.getChainId(),
    );
    const signer = assertNotNull(
      config.ledgerAccount,
      'Ledger signer address not specified',
    );
    const ledgerAddress = await signer.getAddress();
    const signedMessage = await signer.signMessage(ethers.toBeArray(message));
    const signature = await adjustVInSignature(
      SigningMethod.ETH_SIGN,
      signedMessage,
      message,
      ledgerAddress,
    );
    tx.addSignature(new EthSafeSignature(ledgerAddress, signature));

    console.log('\nProposing transaction...');

    const safeContract = assertNotNull(
      safe.getContractManager().safeContract,
      'Safe contract not found',
    );
    const data = await safe.getEncodedTransaction(tx);
    const receipt = await signer
      .sendTransaction({
        to: safeContract.getAddress(),
        data,
      })
      .then(tx => tx.wait(1))
      .then(receipt => receipt!);

    console.log('-> tx hash', receipt.hash);
    return receipt.hash;
  },
);
