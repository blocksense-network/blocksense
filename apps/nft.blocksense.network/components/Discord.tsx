'use client';

import { ChangeEvent, useEffect } from 'react';

import { isDiscordUserMemberOfGuild } from 'service/client';
import { useMintFormContext } from '../app/contexts/MintFormContext';
import { Input } from './Input';

export const Discord = () => {
  const { discord, setDiscord, discordStatus, setDiscordStatus, mintLoading } =
    useMintFormContext();

  useEffect(() => {
    const discordTimeout = setTimeout(() => {
      if (discord !== '') {
        verifyDiscord();
      }
    }, 2000);

    return () => clearTimeout(discordTimeout);
  }, [discord]);

  const onDiscordChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (mintLoading) return;
    setDiscord(e.target.value.trim());
    setDiscordStatus({ type: 'none', message: '' });
  };

  const verifyDiscord = async () => {
    setDiscordStatus({ type: 'loading', message: '' });
    try {
      // const { isMember } = await isDiscordUserMemberOfGuild(discord);
      // if (isMember) {
      setDiscordStatus({
        type: 'success',
        message: 'You are a member of our Discord',
      });
      // } else {
      //   throw new Error('User is not a member of our Discord');
      // }
    } catch (err) {
      console.error(err);
      setDiscordStatus({
        type: 'error',
        message: 'You are not a member of our Discord',
      });
    }
  };

  return (
    <Input
      value={discord}
      onChange={onDiscordChange}
      placeholder="Discord Username"
      id="discord-handle"
      status={discordStatus.type}
      message={discordStatus.message}
    />
  );
};
