import { toBeArray } from 'ethers';

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

export async function executeMultisigTransaction({
  transactions,
  safe,
  config,
}: Params): Promise<string | undefined> {
  const tx = await safe.createTransaction({
    transactions,
  });

  if (!config.deployerIsLedger) {
    console.log('\n[WALLET] Proposing transaction...');

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
  const ledger = config.deployer;
  const ledgerAddress = config.deployerAddress;
  const signedMessage = await ledger.signMessage(toBeArray(message));
  const signature = await adjustVInSignature(
    SigningMethod.ETH_SIGN,
    signedMessage,
    message,
    ledgerAddress,
  );
  tx.addSignature(new EthSafeSignature(ledgerAddress, signature));

  console.log('\n[LEDGER] Proposing transaction...');

  const safeContract = assertNotNull(
    safe.getContractManager().safeContract,
    'Safe contract not found',
  );
  const data = await safe.getEncodedTransaction(tx);
  const receipt = await ledger
    .sendTransaction({
      to: safeContract.getAddress(),
      data,
    })
    .then(tx => tx.wait(1))
    .then(receipt => receipt!);

  console.log('-> tx hash', receipt.hash);
  return receipt.hash;
}
