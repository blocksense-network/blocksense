'use client';

import { MouseEvent } from 'react';
import { sendGAEvent } from '@next/third-parties/google';
import { useActiveAccount } from 'thirdweb/react';

import { ParticipantPayload } from '@blocksense/social-verification/types';
import { getTxHashExplorerUrl, parseTxHash } from '@blocksense/base-utils/evm';

import { mintNFT } from '@/mint';
import {
  checkParticipant,
  hasXUserRetweeted,
  generateMintSignature,
  saveParticipant,
} from 'service/client';
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
    xUserId,
    discord,
    discordStatus,
    retweetCode,
    setRetweetStatus,
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
    !xUserId ||
    !discord ||
    mintLoading ||
    !retweetCode;

  const verifyRetweet = async () => {
    try {
      if (!xUserId) {
        setRetweetStatus({ type: 'error', message: 'X user is not found' });
        return false;
      }

      const { isRetweeted, isCodeCorrect } = await hasXUserRetweeted(
        xUserId,
        retweetCode,
      );

      if (!isRetweeted) {
        throw new Error('User has not retweeted');
      } else if (!isCodeCorrect) {
        setRetweetStatus({
          type: 'error',
          message: 'Your retweet does not contain the correct code',
        });
        return false;
      } else {
        setRetweetStatus({
          type: 'success',
          message: 'User verified successfully',
        });
        return true;
      }
    } catch (err) {
      console.error(err);
      setRetweetStatus({
        type: 'error',
        message: 'You have not quote retweeted our post with the code',
      });
      return false;
    }
  };

  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isMintDisabled) return;

    setMintLoading(true);
    sendGAEvent('event', 'mintButtonClicked', {
      xHandle,
      discord,
      retweetCode,
    });
    setAlertMessage('');

    try {
      const isRetweeted = await verifyRetweet();
      if (!isRetweeted) return;

      const participantsPayload: ParticipantPayload = {
        xHandle,
        discordUsername: discord,
        walletAddress: account.address,
        walletSignature: retweetCode,
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
      const mintingTx = await mintNFT(account, payload, signature);

      sendGAEvent('event', 'mintedNFT', {
        xHandle,
        discord,
        retweetCode,
      });

      participantsPayload.mintingTx = mintingTx;
      await saveParticipant(participantsPayload);

      onSuccessAction(
        getTxHashExplorerUrl('arbitrum-mainnet', parseTxHash(mintingTx)),
        false,
      );
    } catch (err) {
      console.error(err);
      setAlertMessage('An error occurred while minting your NFT');
    } finally {
      setMintLoading(false);
    }
  };

  return (
    <Button
      onClick={onMintClick}
      isLoading={mintLoading}
      disabled={isMintDisabled}
      className="mint-form_button w-full md:mt-12 mt-8"
    >
      Mint My NFT
    </Button>
  );
};
