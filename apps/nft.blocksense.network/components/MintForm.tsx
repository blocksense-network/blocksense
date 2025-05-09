'use client';

import { MouseEvent } from 'react';
import { sendGAEvent } from '@next/third-parties/google';
import { ConnectButton, darkTheme, useActiveAccount } from 'thirdweb/react';
import { signMessage } from 'thirdweb/utils';
import { createWallet } from 'thirdweb/wallets';

import {
  checkParticipant,
  hasXUserRetweeted,
  mintNftBackend,
  saveParticipant,
} from 'service/client';
import { Button } from './Button';
import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { CopyInput } from './CopyInput';
import { RetweetCard } from './RetweetCard';
import { AlertMessage } from './AlertMessage';
import { client, mintNFT } from '@/mint';
import { XHandle } from './XHandle';
import { useMintFormContext } from './MintFormContext';
import { Discord } from './Discord';

const wallets = [createWallet('io.metamask'), createWallet('walletConnect')];
const separatorClassName = 'mint-form__separator md:my-8 my-6';

type MintFormProps = {
  onSuccessAction: (mintTransactionUrl: string) => void;
};

export const MintForm = ({ onSuccessAction }: MintFormProps) => {
  const {
    xHandle,
    xStatus,
    xUserId,
    discord,
    discordStatus,
    retweetCode,
    setRetweetCode,
    retweetStatus,
    setRetweetStatus,
    alertMessage,
    setAlertMessage,
    mintLoading,
    setMintLoading,
  } = useMintFormContext();

  const account = useActiveAccount();

  const isSignDisabled =
    !account || xStatus.type !== 'success' || discordStatus.type !== 'success';

  const isMintDisabled =
    !account ||
    xStatus.type !== 'success' ||
    discordStatus.type !== 'success' ||
    mintLoading ||
    !!alertMessage ||
    !retweetCode;

  const onSignMessageClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSignDisabled) return;

    try {
      const message = `🏴‍☠️ Ahoy! ${discord}, known as @${xHandle}, is part of the Blocksense crew now — welcome aboard!`;
      const signature = await signMessage({
        message,
        account,
      });
      setRetweetCode(signature);
    } catch (err) {
      console.error(err);
      setAlertMessage('An error occurred while signing the message');
    }
  };

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
        setRetweetStatus({
          type: 'error',
          message: 'You have not quote re-posted our announcement',
        });
        return false;
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
        message: 'You have not quote re-posted our announcement',
      });
      return false;
    }
  };

  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isMintDisabled) return;

    sendGAEvent('event', 'mintButtonClicked', {
      xHandle,
      discord,
      retweetCode,
    });

    setMintLoading(true);
    try {
      const isRetweeted = await verifyRetweet();
      if (!isRetweeted) {
        setMintLoading(false);
        return;
      }

      const participantsPayload = {
        xHandle,
        discordUsername: discord,
        walletAddress: account.address,
        walletSignature: retweetCode,
      };

      const { isParticipant } = await checkParticipant(participantsPayload);

      if (isParticipant) {
        setAlertMessage('You have already minted your NFT');
        setMintLoading(false);
        return;
      }

      const { payload, signature } = await mintNftBackend(account.address);
      await mintNFT(account, payload, signature);

      sendGAEvent('event', 'mintedNFT', {
        xHandle,
        discord,
        retweetCode,
      });

      await saveParticipant(participantsPayload);

      onSuccessAction(`https://arbiscan.io/`); // TODO: Add transaction URL - tx/${url}
    } catch (err) {
      console.error(err);
      setAlertMessage('An error occurred while minting your NFT');
    } finally {
      setMintLoading(false);
    }
  };

  return (
    <form className="mint-form border border-[var(--gray-dark)] md:rounded-3xl rounded-2xl md:p-8 px-4 py-6">
      <FormStepContainer>
        <FormStepTitle title="Follow us on X and join our Discord" number={1} />
        <section className="flex md:flex-row flex-col md:gap-4 gap-2">
          <NetworkLink type="x" />
          <NetworkLink type="discord" />
        </section>
      </FormStepContainer>

      <Separator className={separatorClassName} />

      <FormStepContainer>
        <FormStepTitle
          title="Enter your social handles for verification"
          number={2}
        />
        <section className="flex flex-col md:gap-8 gap-6">
          <section className="flex flex-col md:gap-[0.875rem] gap-2">
            <XHandle />
            <Discord />
          </section>
          <section className="flex flex-col gap-4">
            <ConnectButton
              client={client}
              wallets={wallets}
              connectButton={{ label: 'Connect Your Wallet' }}
              connectModal={{
                size: 'compact',
                showThirdwebBranding: false,
              }}
              theme={darkTheme({
                colors: {
                  modalBg: 'hsl(0, 0%, 15%)',
                  borderColor: 'hsl(0, 2%, 26%)',
                  separatorLine: 'hsl(0, 2%, 26%)',
                  accentText: 'hsl(0, 0%, 100%)',
                  success: 'hsl(0, 0%, 85%)',
                },
              })}
            />
            <Button onClick={onSignMessageClick} disabled={isSignDisabled}>
              Sign To Generate Unique Code
            </Button>
          </section>
        </section>
      </FormStepContainer>

      <Separator className={separatorClassName} />

      <FormStepContainer>
        <FormStepTitle
          title="Copy your unique generated code and retweet our announcement with it"
          number={3}
        />
        <section className="flex flex-col md:gap-[0.875rem] gap-2">
          <CopyInput
            value={retweetCode}
            placeholder="Code"
            id="retweet-code"
            readOnly
          />
          <RetweetCard
            retweetCode={retweetCode}
            status={retweetStatus.type}
            message={retweetStatus.message}
          />
        </section>
      </FormStepContainer>

      <Button
        onClick={onMintClick}
        isLoading={mintLoading}
        disabled={isMintDisabled}
        className="mint-form_button w-full md:mt-12 mt-8"
      >
        Mint My NFT
      </Button>
      <AlertMessage message={alertMessage} className="mt-2" />
    </form>
  );
};
