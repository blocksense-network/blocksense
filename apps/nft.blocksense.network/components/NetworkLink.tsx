import Image from 'next/image';

import discordIcon from '/public/icons/discord-form.svg';
import xIcon from '/public/icons/x-form.svg';

const networkLinks = {
  x: {
    title: 'Blocksense Network',
    description: '@blocksense_',
    url: 'https://x.com/blocksense_',
    icon: xIcon,
  },
  discord: {
    title: 'Community',
    description: '+80k members',
    url: 'https://discord.com/invite/blocksense',
    icon: discordIcon,
  },
};

type NetworkLinkProps = {
  type: keyof typeof networkLinks;
};

export const NetworkLink = ({ type }: NetworkLinkProps) => {
  const { description, icon, title, url } = networkLinks[type];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="network_link w-full"
    >
      <section className="bg-[var(--gray-dark)] flex items-center gap-4 border border-[var(--gray-dark)] px-4 py-3 rounded-xl">
        <Image
          src={icon}
          alt="Blocksense Ellipse"
          className="network-link__blocksense-icon md:w-[1.125rem] md:h-[1.125rem] w-6 h-6"
        />
        <div className="network-link__vertical-line bg-[var(--gray-medium)] w-[1px] h-[2.125rem]" />
        <section>
          <p className="network-link__title text-[var(--white)] text-sm">
            {title}
          </p>
          {description && (
            <p className="network-link__description text-[var(--gray-medium)] text-sm">
              {description}
            </p>
          )}
        </section>
      </section>
    </a>
  );
};
