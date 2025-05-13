import Image from 'next/image';
import keccak256 from 'keccak256';

import { clearXHandle } from '@/utils';
import { useMintFormContext } from 'app/contexts/MintFormContext';
import sendArrowIcon from '/public/icons/send-arrow.svg';
import xIcon from '/public/icons/x-form.svg';

export const RetweetCard = () => {
  const { xHandle, discord } = useMintFormContext();

  const retweetCode =
    '0x' +
    keccak256(
      `🏴‍☠️ Ahoy! ${discord}, known as @${clearXHandle(xHandle)}, is part of the Blocksense crew now — welcome aboard!`,
    ).toString('hex');

  return (
    <a
      href={`https://x.com/intent/post?text=${retweetCode}%20https://x.com/blocksense_/status/${process.env['NEXT_PUBLIC_X_BLOCKSENSE_TWEET_ID']}`}
      target="_blank"
      rel="noopener noreferrer"
      className="network_link w-full"
    >
      <section className="flex items-center justify-between bg-[var(--black)] px-8 py-4 rounded-2xl">
        <article className="flex items-center md:gap-[0.875rem] gap-2">
          <Image
            src={xIcon}
            alt="Blocksense X"
            className="retweet-card__x-blocksense-icon"
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
