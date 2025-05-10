import Image from 'next/image';

import telegramIcon from '/public/icons/telegram.svg';
import xIcon from '/public/icons/x.svg';
import discordIcon from '/public/icons/discord.svg';

const socialNetworks = [
  {
    name: 'Telegram',
    url: 'https://t.me/BlocksenseNetwork',
    icon: telegramIcon,
  },
  {
    name: 'X',
    url: 'https://x.com/blocksense_',
    icon: xIcon,
  },
  {
    name: 'Discord',
    url: 'https://discord.com/invite/mYujUXwrMr',
    icon: discordIcon,
  },
];

export const SocialNetworks = () => {
  return (
    <section className="social-networks flex items-center justify-center gap-2">
      {socialNetworks.map(network => (
        <a
          href={network.url}
          key={network.name}
          className="social-network bg-[var(--gray-dark)] hover:bg-[#666] transition-colors duration-350 rounded-[0.5rem] w-12 h-12 flex items-center justify-center"
          aria-label={network.name}
          title={network.name}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            className="social-network__icon"
            src={network.icon}
            alt={network.name}
          />
        </a>
      ))}
    </section>
  );
};
