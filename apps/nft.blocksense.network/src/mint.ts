import { createThirdwebClient, getContract, sendTransaction } from 'thirdweb';
import { sepolia } from 'thirdweb/chains';
import { Account } from 'thirdweb/wallets';
import { mintWithSignature, balanceOf } from 'thirdweb/extensions/erc721';

import { assertNotNull } from '@blocksense/base-utils/assert';

const CLIENT_ID = assertNotNull(process.env['NEXT_PUBLIC_NFT_CLIENT_ID']);
const CONTRACT_ADDRESS = assertNotNull(
  process.env['NEXT_PUBLIC_NFT_SMART_CONTRACT_ADDRESS'],
);

export const client = createThirdwebClient({
  clientId: CLIENT_ID,
});

const contract = getContract({
  client,
  chain: sepolia,
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

  await sendTransaction({ transaction, account });
};
