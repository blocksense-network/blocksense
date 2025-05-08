'use client';

import { ChangeEvent, MouseEvent, useState } from 'react';
import { sendGAEvent } from '@next/third-parties/google';

import { Button } from './Button';
import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { Input } from './Input';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { CopyInput } from './CopyInput';

const separatorClassName = 'mint-form__separator md:my-8 my-6';

type MintFormProps = {
  onSuccessAction: () => void;
};

export const MintForm = ({ onSuccessAction }: MintFormProps) => {
  const [xHandle, setXHandle] = useState('');
  const [xLoading, setXLoading] = useState(false);
  const [xError, setXError] = useState('');
  const [xSuccess, setXSuccess] = useState('');

  const [discord, setDiscord] = useState('');
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordError, setDiscordError] = useState('');
  const [discordSuccess, setDiscordSuccess] = useState('');

  const [retweetCode, setRetweetCode] = useState('');
  const [mintLoading, setMintLoading] = useState(false);

  const onMintClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    sendGAEvent('event', 'mintButtonClicked', {
      xHandle,
      discord,
      retweetCode,
    });

    sendGAEvent('event', 'mintedNFT', {
      xHandle,
      discord,
      retweetCode,
    });

    setRetweetCode('');
    // setMintLoading(true);
    onSuccessAction();
  };

  const onXHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setXHandle(e.target.value);
  };

  const onDiscordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDiscord(e.target.value);
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
          />
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
