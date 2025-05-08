import Image from 'next/image';

import { StatusMessage, StatusType } from './StatusMessage';
import blocksenseEllipseIcon from '/public/icons/blocksense-ellipse.svg';
import sendArrowIcon from '/public/icons/send-arrow.svg';

type RetweetCardProps = {
  retweetCode: string;
  status?: StatusType;
  message?: string;
};

export const RetweetCard = ({
  retweetCode = '',
  status,
  message,
}: RetweetCardProps) => {
  return (
    <article className="retweet-card__container flex flex-col gap-2">
      <a
        href={`https://x.com/intent/post?text=${retweetCode}%20https://x.com/blocksense_/status/${process.env['NEXT_PUBLIC_X_BLOCKSENSE_TWEET_ID']}`}
        target="_blank"
        rel="noopener noreferrer"
        className="network_link"
      >
        <section
          className={`flex items-center justify-between bg-[var(--gray-dark)] border border-[var(--gray-dark)] px-4 py-3 rounded-2xl ${status === 'error' && 'border-[var(--red)]'} ${status === 'success' && 'border-[var(--green)]'}`}
        >
          <article className="flex items-center md:gap-[0.875rem] gap-2">
            <Image
              src={blocksenseEllipseIcon}
              alt="Blocksense Ellipse"
              className="retweet-card__blocksense-icon"
            />
            <p className="retweet-card__title text-[var(--white)] md:text-base text-sm">
              Retweet our announcement
            </p>
          </article>
          <Image
            src={sendArrowIcon}
            alt="Send Arrow"
            className="retweet-card__send-icon"
          />
        </section>
      </a>
      <StatusMessage status={status} message={message} />
    </article>
  );
};
