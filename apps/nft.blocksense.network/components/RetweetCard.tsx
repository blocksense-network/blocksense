import Image from 'next/image';
import keccak256 from 'keccak256';

import { assertNotNull } from '@blocksense/base-utils/assert';

import { clearXHandle } from '@/utils';
import { useMintFormContext } from 'app/contexts/MintFormContext';
import xIcon from '/public/icons/x-form.svg';
import sendArrowIcon from '/public/icons/send-arrow.svg';

export const RetweetCard = () => {
  const { xHandle, discord, xStatus, discordStatus } = useMintFormContext();
  const tweetId = assertNotNull(
    process.env['NEXT_PUBLIC_X_BLOCKSENSE_TWEET_ID'],
  );
  const isDisabled =
    xStatus.type !== 'success' || discordStatus.type !== 'success';

  const retweetCode =
    '0x' +
    keccak256(
      `🏴‍☠️ Ahoy! ${discord}, known as @${clearXHandle(xHandle)}, is part of the Blocksense crew now — welcome aboard!`,
    ).toString('hex');

  return (
    <a
      href={`https://x.com/intent/post?text=${retweetCode}%20https://x.com/blocksense_/status/${tweetId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`network_link w-full ${isDisabled && 'opacity-[0.3] pointer-events-none'}`}
    >
      <section className="flex items-center justify-between bg-[var(--black)] px-8 py-4 rounded-2xl">
        <article className="flex items-center md:gap-[0.875rem] gap-2">
          <Image
            src={xIcon}
            alt="Blocksense X"
            className="retweet-card__blocksense-x-icon"
          />
          <p className="retweet-card__title text-[var(--white)] md:text-base text-sm">
            Retweet announcement
          </p>
        </article>
        <Image
          src={sendArrowIcon}
          alt="Send Arrow"
          className="retweet-card__send-icon"
        />
      </section>
    </a>
  );
};
