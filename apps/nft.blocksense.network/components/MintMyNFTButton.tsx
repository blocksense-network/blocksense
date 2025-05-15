'use client';

import { MouseEvent } from 'react';
import { sendGAEvent } from '@next/third-parties/google';
import { useActiveAccount } from 'thirdweb/react';

import { ParticipantPayload } from '@blocksense/social-verification/types';
import { getTxHashExplorerUrl, parseTxHash } from '@blocksense/base-utils/evm';

import { mintNFT } from '@/mint';
import { clearXHandle } from '@/utils';
import { checkParticipant, generateMintSignature } from 'service/client';
import { useMintFormContext } from '../app/contexts/MintFormContext';
import { Button } from './Button';

type MintMyNFTButtonProps = {
  onSuccessAction: (
    mintTransactionUrl: string,
    isAlreadyMinted: boolean,
  ) => void;
};

export const MintMyNFTButton = ({ onSuccessAction }: MintMyNFTButtonProps) => {
  const {
    xHandle,
    xStatus,
    discord,
    discordStatus,
    setAlertMessage,
    mintLoading,
    setMintLoading,
  } = useMintFormContext();
  const account = useActiveAccount();

  const isMintDisabled =
    !account ||
    xStatus.type !== 'success' ||
    discordStatus.type !== 'success' ||
    !xHandle ||
    !discord ||
    mintLoading;

  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isMintDisabled) return;

    setMintLoading(true);
    setAlertMessage('');

    try {
      const resultXHandle = clearXHandle(xHandle);

      const participantsPayload: ParticipantPayload = {
        xHandle: resultXHandle,
        discordUsername: discord,
        walletAddress: account.address,
      };

      const { isParticipant, mintingTx: mintingTxFromDB } =
        await checkParticipant(participantsPayload);

      if (isParticipant) {
        onSuccessAction(
          getTxHashExplorerUrl(
            'arbitrum-mainnet',
            parseTxHash(mintingTxFromDB),
          ),
          true,
        );
        return;
      }

      const { payload, signature } = await generateMintSignature(
        account.address,
      );
      if (!payload || !signature) {
        setAlertMessage('Failed to generate mint signature');
        return;
      }

      const mintingTx = await mintNFT(
        account,
        payload,
        signature,
        participantsPayload,
        setAlertMessage,
      );

      sendGAEvent('event', 'mintedNFT', {
        xHandle: resultXHandle,
        discord,
        walletAddress: account.address,
      });

      onSuccessAction(
        getTxHashExplorerUrl('arbitrum-mainnet', parseTxHash(mintingTx)),
        false,
      );
    } catch (err) {
      console.error(err);
      setAlertMessage('An error occurred while minting. Try again!');
    } finally {
      setMintLoading(false);
    }
  };

  return (
    <Button
      onClick={onMintClick}
      isLoading={mintLoading}
      disabled={isMintDisabled}
      className="mint-form_button w-full mt-4"
    >
      Mint My NFT
    </Button>
  );
};
