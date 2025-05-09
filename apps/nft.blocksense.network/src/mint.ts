import { createThirdwebClient, getContract, sendTransaction } from 'thirdweb';
import { arbitrum, sepolia } from 'thirdweb/chains';
import { Account, smartWallet } from 'thirdweb/wallets';
import { mintWithSignature, balanceOf } from 'thirdweb/extensions/erc721';
// import { ethers } from 'ethers';
import Web3 from 'web3';

import { assertNotNull } from '@blocksense/base-utils/assert';
import { watch } from 'fs';

const CLIENT_ID = assertNotNull(process.env['NEXT_PUBLIC_NFT_CLIENT_ID']);
const CONTRACT_ADDRESS = assertNotNull(
  process.env['NEXT_PUBLIC_NFT_SMART_CONTRACT_ADDRESS'],
);

export const client = createThirdwebClient({
  clientId: CLIENT_ID,
});

const contract = getContract({
  client,
  chain: arbitrum,
  address: CONTRACT_ADDRESS,
});

export const getNftBalance = async (
  accountAddress: string,
): Promise<bigint> => {
  if (!accountAddress) return BigInt(0);
  return await balanceOf({
    contract,
    owner: accountAddress,
  });
};

export const mintNFT = async (
  account: Account,
  payload: any,
  signature: any,
) => {
  const transaction = mintWithSignature({
    contract,
    payload,
    signature,
  });

  const _smartWallet = smartWallet({
    chain: arbitrum,
    sponsorGas: true,
  });

  const smartAccount = await _smartWallet.connect({
    client,
    personalAccount: account!,
  });

  const receipt = await sendTransaction({ transaction, account: smartAccount });

  const { transactionHash } = receipt;
  const tokenId = await getTokenId(transactionHash);

  await confirmAssetInAccount(account, tokenId);

  return transactionHash;
};

async function confirmAssetInAccount(
  account: Account,
  tokenId: string,
  maxTries = 10,
) {
  let confirmed = null;
  let attempts = 0;

  while (!confirmed && attempts < maxTries) {
    try {
      confirmed = await account.watchAsset!({
        type: 'ERC721',
        options: {
          address: CONTRACT_ADDRESS,
          tokenId: `${tokenId}`,
        },
      } as any);
    } catch (e) {
      // Optionally log or handle errors
    }

    if (!confirmed) {
      attempts++;
      await sleep(3000);
    }
  }

  return confirmed;
}

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

export async function getTokenId(txHash: string): Promise<string> {
  const web3 = new Web3('https://arb1.arbitrum.io/rpc');

  let receipt = null;
  while (!receipt) {
    try {
      receipt = await web3.eth.getTransactionReceipt(txHash);
    } catch {
      // Just wait and retry
    }
    if (!receipt) {
      await sleep(3000); // Poll every 3 seconds
    }
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
