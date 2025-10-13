import { toBeArray } from 'ethers';

import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import Safe, { EthSafeSignature } from '@safe-global/protocol-kit';
import { assertNotNull } from '@blocksense/base-utils';

import type { NetworkConfig } from '../types';
import { adjustVInSignature } from '../utils';
import { sendTx } from './send-tx';

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

  const message = await safe.getTransactionHash(tx);
  const ledger = config.deployer;
  const ledgerAddress = config.deployerAddress;
  const signedMessage = await ledger.signMessage(toBeArray(message));
  const signature = await adjustVInSignature(signedMessage);
  tx.addSignature(new EthSafeSignature(ledgerAddress, signature));

  const walletType = config.deployerIsLedger ? 'LEDGER' : 'WALLET';
  console.log(`\n[${walletType}] Proposing transaction...`);

  const safeContract = assertNotNull(
    safe.getContractManager().safeContract,
    'Safe contract not found',
  );
  const data = await safe.getEncodedTransaction(tx);

  const receipt = await sendTx({
    config,
    to: safeContract.getAddress(),
    data,
  });

  console.log('-> tx hash', receipt!.hash);
  return receipt!.hash;
}
