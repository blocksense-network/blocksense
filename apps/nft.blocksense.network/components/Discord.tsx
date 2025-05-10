'use client';

import { ChangeEvent, useEffect } from 'react';

import { isDiscordUserMemberOfGuild } from 'service/client';
import { Input } from './Input';
import { useMintFormContext } from './MintFormContext';

export const Discord = () => {
  const { discord, setDiscord, discordStatus, setDiscordStatus } =
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
    setDiscord(e.target.value);
    setDiscordStatus({ type: 'none', message: '' });
  };

  const verifyDiscord = async () => {
    setDiscordStatus({ type: 'loading', message: '' });
    try {
      if (discord[0] === '#') {
        setDiscordStatus({
          type: 'error',
          message: 'Discord handle should not start with #',
        });
        return;
      }
      const { isMember } = await isDiscordUserMemberOfGuild(discord);
      if (!isMember) {
        setDiscordStatus({
          type: 'error',
          message: 'You are not a member of our Discord server',
        });
        return;
      } else {
        setDiscordStatus({
          type: 'success',
          message: 'User verified successfully',
        });
      }
    } catch (err) {
      console.error(err);
      setDiscordStatus({
        type: 'error',
        message: 'You are not a member of our Discord server',
      });
    }
  };

  return (
    <Input
      value={discord}
      onChange={onDiscordChange}
      placeholder="Discord #"
      id="discord-handle"
      status={discordStatus.type}
      message={discordStatus.message}
    />
  );
};
