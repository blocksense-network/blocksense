import {
  Address,
  createThirdwebClient,
  getContract,
  sendTransaction,
} from 'thirdweb';
import { sepolia } from 'thirdweb/chains';
import { Account, privateKeyToAccount } from 'thirdweb/wallets';
import {
  generateMintSignature,
  mintWithSignature,
  balanceOf,
} from 'thirdweb/extensions/erc721';

import { assertNotNull } from '@blocksense/base-utils/assert';

const metadata = {
  name: 'Blocksense NFT Pirate',
  description: 'Exclusive NFT for Blocksense supporters.',
  image: 'https://data.nft.blocksense.network/bsx-pirate-nft.png',
  attributes: [
    {
      trait_type: 'Author',
      value: 'Sean Go',
    },
    {
      trait_type: 'Company',
      value: 'Blocksense',
    },
    {
      trait_type: 'Website',
      value: 'https://blocksense.network',
    },
  ],
};

const CLIENT_ID = assertNotNull(process.env['NEXT_PUBLIC_NFT_CLIENT_ID']);
const CONTRACT_ADDRESS = assertNotNull(
  process.env['NEXT_PUBLIC_NFT_SMART_CONTRACT_ADDRESS'],
);
const PRIVATE_KEY = assertNotNull(process.env['NEXT_PUBLIC_NFT_PRIVATE_KEY']);

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

export const mintNFT = async (account: Account) => {
  const admin = privateKeyToAccount({
    client,
    privateKey: PRIVATE_KEY,
  });

  const { payload, signature } = await generateMintSignature({
    account: admin,
    contract,
    mintRequest: {
      to: account.address,
      metadata,
    },
    contractType: 'TokenERC721',
  });

  const transaction = mintWithSignature({
    contract,
    payload,
    signature,
  });

  await sendTransaction({ transaction, account });

  return metadata;
};
