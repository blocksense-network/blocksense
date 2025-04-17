'use client';

import { ChangeEvent, MouseEvent, useState } from 'react';

import { Button } from './Button';
import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { Input } from './Input';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { CopyInput } from './CopyInput';

const separatorClassName = 'md:my-8 my-6';

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
    <form className="border border-[var(--gray-dark)] md:rounded-3xl rounded-2xl md:p-8 px-4 py-6">
      <FormStepContainer>
        <FormStepTitle title="Follow us on X" number={1} />
        <NetworkLink
          title="Blocksense Network"
          description="@blocksense_"
          link="https://x.com/blocksense_"
        />
      </FormStepContainer>

      <Separator className={separatorClassName} />

      <FormStepContainer>
        <FormStepTitle title="Join our Discord community" number={2} />
        <NetworkLink
          title="Community"
          description="+20k members"
          link="https://discord.com/invite/mYujUXwrMr"
        />
      </FormStepContainer>

      <Separator className={separatorClassName} />

      <FormStepContainer>
        <FormStepTitle
          title="Enter your social handles for verification"
          number={3}
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
          number={4}
        />
        <section className="flex flex-col md:gap-[0.875rem] gap-2">
          <CopyInput
            value={retweetCode}
            placeholder="Code"
            id="retweet-code"
            readOnly
          />
          <NetworkLink
            title="Retweet our announcement"
            link={`https://x.com/intent/post?text=${retweetCode}%20https://x.com/blocksense_/status/tweet_id`} //TODO: Add correct tweet_id
          />
        </section>
      </FormStepContainer>

      <Button
        onClick={onMintClick}
        isLoading={mintLoading}
        className="w-full md:mt-8 mt-6"
      >
        Mint My NFT
      </Button>
    </form>
  );
};
