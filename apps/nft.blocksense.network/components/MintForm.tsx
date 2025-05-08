'use client';

import { ChangeEvent, MouseEvent, useState } from 'react';
import { sendGAEvent } from '@next/third-parties/google';
import { Effect } from 'effect';
import { ConnectButton, darkTheme, useActiveAccount } from 'thirdweb/react';
import { signMessage } from 'thirdweb/utils';
import { createWallet } from 'thirdweb/wallets';

import {
  checkParticipant,
  hasXUserRetweeted,
  isDiscordUserMemberOfGuild,
  isXUserFollowing,
  mintNftBackend,
  saveParticipant,
} from 'service/client';
import { Button } from './Button';
import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { Input } from './Input';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { CopyInput } from './CopyInput';
import { RetweetCard } from './RetweetCard';
import { client, mintNFT } from '@/mint';

const wallets = [createWallet('io.metamask'), createWallet('walletConnect')];

const separatorClassName = 'mint-form__separator md:my-8 my-6';

type MintFormProps = {
  onSuccessAction: () => void;
};

export const MintForm = ({ onSuccessAction }: MintFormProps) => {
  const [xHandle, setXHandle] = useState('');
  const [xLoading, setXLoading] = useState(false);
  const [xError, setXError] = useState('');
  const [xSuccess, setXSuccess] = useState('');
  const [xUserId, setXUserId] = useState<string | null>(null);

  const [discord, setDiscord] = useState('');
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordError, setDiscordError] = useState('');
  const [discordSuccess, setDiscordSuccess] = useState('');

  const [retweetCode, setRetweetCode] = useState('');
  const [retweetError, setRetweetError] = useState('');
  const [retweetSuccess, setRetweetSuccess] = useState('');

  const [mintLoading, setMintLoading] = useState(false);

  const account = useActiveAccount();

  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // await verifyRetweet();

    sendGAEvent('event', 'mintButtonClicked', {
      xHandle,
      discord,
      retweetCode,
    });

    if (!account) {
      return;
    }

    setMintLoading(true);

    const participantsPayload = {
      xHandle,
      discordUsername: discord,
      walletAddress: account.address,
      walletSignature: retweetCode,
    };

    const { isParticipant } = await checkParticipant(participantsPayload);

    if (isParticipant) {
      setRetweetError('You have already minted your NFT');
      setMintLoading(false);
      return;
    }

    try {
      const { payload, signature } = await mintNftBackend(account.address);
      await mintNFT(account, payload, signature);

      sendGAEvent('event', 'mintedNFT', {
        xHandle,
        discord,
        retweetCode,
      });

      await saveParticipant(participantsPayload);

      onSuccessAction();
    } catch (err: any) {
      setRetweetError(err.message);
    } finally {
      setMintLoading(false);
    }
  };

  const onXHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setXHandle(e.target.value);
  };

  const onDiscordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDiscord(e.target.value);
  };

  const verifyDiscord = async () => {
    setDiscordLoading(true);
    try {
      const { isMember } = await isDiscordUserMemberOfGuild(discord);
      if (!isMember) {
        setDiscordError('You are not a member of our Discord server');
        setDiscordSuccess('');
        return;
      } else {
        setDiscordError('');
        setDiscordSuccess('User verified successfully');
      }
    } catch (err: any) {
      setDiscordError(err.message);
    } finally {
      setDiscordLoading(false);
    }
  };

  const verifyXHandle = async () => {
    setXLoading(true);
    try {
      const { isFollowing, userId } = await isXUserFollowing(xHandle);

      setXUserId(userId);
      if (!isFollowing) {
        setXError('You are not following us on X');
        setXSuccess('');
        return;
      } else {
        setXError('');
        setXSuccess('User verified successfully');
      }
    } catch (err: any) {
      setXError(err.message);
    } finally {
      setXLoading(false);
    }
  };

  const verifyRetweet = async () => {
    setMintLoading(true);

    if (!xUserId) {
      setRetweetError('X user ID is not available');
      setMintLoading(false);
      return;
    }

    try {
      const { isRetweeted, isCodeCorrect } = await hasXUserRetweeted(
        xUserId,
        retweetCode,
      );

      if (!isRetweeted) {
        setRetweetError('You have not quote re-posted our announcement');
        setRetweetSuccess('');
      } else if (!isCodeCorrect) {
        setRetweetError('Your retweet does not contain the correct code');
        setRetweetSuccess('');
      } else {
        setRetweetError('');
        setRetweetSuccess('User verified successfully');
      }
    } catch (err: any) {
      setRetweetError(err.message);
    } finally {
      setMintLoading(false);
    }
  };

  const onSignMessageClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!account) {
      return;
    }

    try {
      const message = `🏴‍☠️ Ahoy! ${discord}, known as @${xHandle}, is part of the Blocksense crew now — welcome aboard!`;
      const signature = await signMessage({
        message,
        account,
      });
      setRetweetCode(signature);
    } catch (err: any) {
      setRetweetError(err.message);
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
        <section className="flex flex-col md:gap-[0.875rem] gap-2">
          <Input
            value={xHandle}
            onChange={onXHandleChange}
            placeholder="X handle"
            id="x-handle"
            isLoading={xLoading}
            status={xError ? 'error' : xSuccess ? 'success' : undefined}
            message={xError ? xError : xSuccess ? xSuccess : ''}
            onBlur={verifyXHandle}
          />
          <Input
            value={discord}
            onChange={onDiscordChange}
            placeholder="Discord #"
            id="discord-handle"
            isLoading={discordLoading}
            status={
              discordError ? 'error' : discordSuccess ? 'success' : undefined
            }
            message={
              discordError ? discordError : discordSuccess ? discordSuccess : ''
            }
            onBlur={verifyDiscord}
          />
        </section>
      </FormStepContainer>

      <Separator className={separatorClassName} />

      <FormStepContainer>
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

        <Button onClick={onSignMessageClick}>
          Sign message with your wallet to continue
        </Button>

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
            status={
              retweetError ? 'error' : retweetSuccess ? 'success' : undefined
            }
            message={
              retweetError ? retweetError : retweetSuccess ? retweetSuccess : ''
            }
          />
        </section>
      </FormStepContainer>

      <Button
        onClick={onMintClick}
        isLoading={mintLoading}
        className="mint-form_button w-full md:mt-8 mt-6"
      >
        Mint My NFT
      </Button>
    </form>
  );
};
