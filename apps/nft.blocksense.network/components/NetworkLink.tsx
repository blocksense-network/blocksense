import Image from 'next/image';

import blocksenseEllipseIcon from '/public/icons/blocksense-ellipse.svg';
import sendArrowIcon from '/public/icons/send-arrow.svg';
import { StatusMessage, StatusType } from './StatusMessage';

type NetworkLinkProps = {
  title: string;
  description?: string;
  link: string;
  status?: StatusType;
  message?: string;
};

export const NetworkLink = ({
  title,
  description,
  link,
  status,
  message,
}: NetworkLinkProps) => {
  return (
    <article className="flex flex-col gap-2">
      <a href={link} target="_blank" rel="noopener noreferrer">
        <section
          className={`flex items-center justify-between bg-[var(--gray-dark)] border border-[var(--gray-dark)] px-4 py-3 rounded-2xl ${status === 'error' && 'border-[var(--red)]'} ${status === 'success' && 'border-[var(--green)]'}`}
        >
          <article className="flex items-center md:gap-[0.875rem] gap-2">
            <Image src={blocksenseEllipseIcon} alt="Blocksense Ellipse" />
            <section>
              <p className="text-[var(--white)] md:text-base text-sm">
                {title}
              </p>
              {description && (
                <p className="text-[var(--gray-medium)] md:text-sm text-xs">
                  {description}
                </p>
              )}
            </section>
          </article>
          <Image src={sendArrowIcon} alt="Send Arrow" />
        </section>
      </a>
      <StatusMessage status={status} message={message} />
    </article>
  );
};
