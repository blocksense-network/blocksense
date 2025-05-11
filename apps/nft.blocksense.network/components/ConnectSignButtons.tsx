'use client';

import { MouseEvent } from 'react';
import { ConnectButton, darkTheme, useActiveAccount } from 'thirdweb/react';
import { signMessage } from 'thirdweb/utils';
import { createWallet } from 'thirdweb/wallets';

import { client } from '@/mint';
import { useMintFormContext } from '../app/contexts/MintFormContext';
import { Button } from './Button';

const wallets = [createWallet('io.metamask'), createWallet('walletConnect')];

export const ConnectSignButtons = () => {
  const {
    xHandle,
    xStatus,
    discord,
    discordStatus,
    setRetweetCode,
    setAlertMessage,
  } = useMintFormContext();
  const account = useActiveAccount();

  const isSignDisabled =
    !account ||
    xStatus.type !== 'success' ||
    discordStatus.type !== 'success' ||
    !xHandle ||
    !discord;

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
      setRetweetCode('');
    }
  };

  return (
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
  );
};
