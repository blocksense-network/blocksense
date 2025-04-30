'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useState,
  MouseEvent,
} from 'react';

import { useActiveAccount } from 'thirdweb/react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';

import { Button } from './Button';
import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { Input } from './Input';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { CopyInput } from './CopyInput';
import { MintAlert } from './MintAlert';
import { ConnectButton, darkTheme } from 'thirdweb/react';
import { client, getNftBalance, mintNFT } from '@/mint';

const wallets = [
  inAppWallet(),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
];

const separatorClassName = 'mint-form__separator md:my-8 my-6';

type MintFormProps = {
  onSuccessAction: (metadata: {
    name: string;
    description: string;
    image: string;
  }) => void;
};

export const MintForm = ({ onSuccessAction }: MintFormProps) => {
  const [nftBalance, setBalance] = useState<bigint>(BigInt(0));
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

  const account = useActiveAccount();

  useEffect(() => {
    if (account?.address) {
      getNftBalance(account.address).then(setBalance);
    }
  }, [account]);

  //TODO: Handle this better
  if (nftBalance > 0) {
    alert('You already have a token!');
    return;
  }

  const mint = useCallback(async () => {
    if (!account) {
      alert('Please connect your wallet first.');
      return;
    }

    setMintLoading(true);

    try {
      const metadata = await mintNFT(account);
      onSuccessAction(metadata);
    } catch (error: any) {
      console.error(error);
      alert('Failed to mint NFT: ' + error.message);
    } finally {
      setMintLoading(false);
    }
  }, [account, onSuccessAction]);
  const onMintClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await mint();
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
      <ConnectButton
        client={client}
        wallets={wallets}
        showAllWallets={false}
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
      {account && (
        <Button
          onClick={onMintClick}
          isLoading={mintLoading}
          className="mint-form_button w-full mt-4 transition-all duration-500 ease-in-out opacity-100 translate-y-0"
        >
          Mint My NFT
        </Button>
      )}
      <MintAlert className="mint-alert" message="You already have a token" />
    </form>
  );
};
