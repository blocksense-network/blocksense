import Web3 from 'web3';
import { createThirdwebClient, getContract, sendTransaction } from 'thirdweb';
import { arbitrum } from 'thirdweb/chains';
import { Account, smartWallet } from 'thirdweb/wallets';
import { mintWithSignature } from 'thirdweb/extensions/erc721';

import { ParticipantPayload } from '@blocksense/social-verification/types';
import { assertNotNull } from '@blocksense/base-utils/assert';
import { loopWhile } from '@blocksense/base-utils/async';
import { saveParticipant } from 'service/client';

export function getClient() {
  const CLIENT_ID = assertNotNull(process.env['NEXT_PUBLIC_NFT_CLIENT_ID']);
  return createThirdwebClient({
    clientId: CLIENT_ID,
  });
}

export const mintNFT = async (
  account: Account,
  payload: any,
  signature: any,
  participantsPayload: ParticipantPayload,
  setAlertMessage: (message: string) => void,
) => {
  const CONTRACT_ADDRESS = assertNotNull(
    process.env['NEXT_PUBLIC_NFT_SMART_CONTRACT_ADDRESS'],
  );
  const client = getClient();

  const _smartWallet = smartWallet({
    chain: arbitrum,
    sponsorGas: true,
  });

  const smartAccount = await _smartWallet.connect({
    client,
    personalAccount: account,
  });

  const contract = getContract({
    client,
    chain: arbitrum,
    address: CONTRACT_ADDRESS,
  });

  const transaction = mintWithSignature({
    contract,
    payload,
    signature,
  });

  const { transactionHash } = await sendTransaction({
    transaction,
    account: smartAccount,
  });

  participantsPayload.mintingTx = transactionHash;
  await saveParticipant(participantsPayload);
  console.info('NFT minted successfully!');

  try {
    setAlertMessage('Adding your NFT to your wallet...');
    await confirmAssetInAccount(account, CONTRACT_ADDRESS, transactionHash);
  } catch (e) {
    console.error('Error confirming asset in account');
  }

  console.info(`NFT minted successfully! Transaction hash: ${transactionHash}`);
  return transactionHash;
};

async function confirmAssetInAccount(
  account: Account,
  contractAddress: string,
  transactionHash: string,
) {
  const tokenId = await getTokenId(transactionHash);

  const success = await loopWhile(
    (success: boolean) => !success,
    async () => {
      if (!account.watchAsset) return false;

      try {
        const success = await account.watchAsset({
          type: 'ERC721',
          options: {
            address: contractAddress,
            tokenId: tokenId,
          },
        } as any);
        return success;
      } catch (e) {
        return false;
      }
    },
    1000,
    30, // 30 seconds max wait time for confirmation
  );

  return success;
}

export async function getTokenId(txHash: string): Promise<string> {
  const transferEventABI = {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  };

  const web3 = new Web3('https://arb1.arbitrum.io/rpc');

  const receipt = await loopWhile(
    (receipt: any) => !receipt,
    async () => {
      try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        return receipt;
      } catch (e) {
        return null;
      }
    },
    1000,
  );

  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }

  for (const log of receipt.logs) {
    try {
      const decoded = web3.eth.abi.decodeLog(
        transferEventABI.inputs,
        log.data!,
        log.topics!.slice(1),
      );

      return `${decoded['tokenId']}`;
    } catch {}
  }

  throw new Error('Transfer event with tokenId not found');
}
