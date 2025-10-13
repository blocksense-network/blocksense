'use client';

import { sendGAEvent } from '@next/third-parties/google';
import type { MouseEvent } from 'react';
import { checkParticipant, generateMintSignature } from 'service/client';
import { useActiveAccount } from 'thirdweb/react';

import { getTxHashExplorerUrl, parseTxHash } from '@blocksense/base-utils/evm';
import type { ParticipantPayload } from '@blocksense/social-verification/types';
import { mintNFT } from '@/mint';
import { clearXHandle } from '@/utils';

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
    discord,
    discordStatus,
    mintLoading,
    retweetCode,
    setAlertMessage,
    setMintLoading,
    setRetweetStatus,
    xHandle,
    xStatus,
    xUserId,
  } = useMintFormContext();
  const account = useActiveAccount();

  const isMintDisabled =
    !account ||
    xStatus.type !== 'success' ||
    discordStatus.type !== 'success' ||
    !xHandle ||
    !discord ||
    !xUserId ||
    mintLoading ||
    !retweetCode;

  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isMintDisabled) return;

    setMintLoading(true);
    setAlertMessage('');
    setRetweetStatus({ type: 'none', message: '' });

    try {
      const resultXHandle = clearXHandle(xHandle);

      const participantsPayload: ParticipantPayload = {
        xHandle: resultXHandle,
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

      const generateMintSignatureResult = await generateMintSignature(
        account.address,
        xUserId,
        clearXHandle(xHandle),
        discord,
        retweetCode,
      );
      if ('error' in generateMintSignatureResult) {
        if (
          generateMintSignatureResult.error ===
          `Account ${account.address} already has an NFT`
        ) {
          setAlertMessage('You have already minted this NFT');
          onSuccessAction(
            `https://arbiscan.io/address/${account.address}#nfttransfers`,
            true,
          );
          return;
        } else {
          setRetweetStatus({
            type: 'error',
            message: generateMintSignatureResult.error,
          });
          setAlertMessage(generateMintSignatureResult.error);
          return;
        }
      }

      const { payload, signature } = generateMintSignatureResult;

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
        retweetCode,
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
      className="mint-form_button w-full md:mt-12 mt-8"
    >
      Mint My NFT
    </Button>
  );
};
