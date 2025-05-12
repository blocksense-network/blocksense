import Image from 'next/image';

import { StatusMessage } from './StatusMessage';
import blocksenseEllipseIcon from '/public/icons/blocksense-ellipse.svg';
import sendArrowIcon from '/public/icons/send-arrow.svg';
import { useMintFormContext } from '../app/contexts/MintFormContext';

export const RetweetCard = () => {
  const { retweetCode, retweetStatus } = useMintFormContext();

  return (
    <article className="retweet-card__container flex flex-col gap-2">
      <a
        href={`https://x.com/intent/post?text=${retweetCode}%20https://x.com/blocksense_/status/${process.env['NEXT_PUBLIC_X_BLOCKSENSE_TWEET_ID']}`}
        target="_blank"
        rel="noopener noreferrer"
        className="network_link"
      >
        <section
          className={`flex items-center justify-between bg-[var(--gray-dark)] border border-[var(--gray-dark)] px-4 py-[0.688rem] rounded-2xl ${retweetStatus.type === 'error' && 'border-[var(--red)]'} ${retweetStatus.type === 'success' && 'border-[var(--green)]'}`}
        >
          <article className="flex items-center md:gap-[0.875rem] gap-2">
            <Image
              src={blocksenseEllipseIcon}
              alt="Blocksense Ellipse"
              className="retweet-card__blocksense-icon"
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
      <StatusMessage
        status={retweetStatus.type}
        message={retweetStatus.message}
      />
    </article>
  );
};
