import React from 'react';

import { config } from '@/config';
import { ImageWrapper } from '@/components/common/ImageWrapper';

export const Footer = () => {
  return (
    <footer
      className="footer nx-mx-auto nx-flex nx-h-[var(--nextra-navbar-height)] nx-max-w-[90rem]
  nx-items-center nx-justify-end nx-gap-2 nx-pl-[max(env(safe-area-inset-left),1.5rem)]
  nx-pr-[max(env(safe-area-inset-right),1.5rem)] h-20"
    >
      <aside className="footer__link ltr:nx-mr-auto rtl:nx-ml-auto space-x-4 p-2">
        <a
          className="footer__social-icon flex items-center space-x-2"
          href={config.adoptersTextLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ImageWrapper
            src="/icons/blocksense-rocket-icon.svg"
            alt={config.adoptersAltLink}
            className="footer__social-icon-img relative w-6 h-6"
          />
          <span className="footer__social-label font-semibold text-gray-900 hidden lg:block">
            Early Adopters
          </span>
        </a>
      </aside>
      <nav className="footer__social-nav flex items-center nx-justify-end">
        <ul className="footer__social-list flex gap-2">
          <li className="footer__social-item flex items-center space-x-4 p-2">
            <a
              className="footer__social-icon footer__social-icon--telegram flex items-center space-x-2"
              href={config.social_media.telegram._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-telegram.svg"
                alt={config.social_media.telegram._alt}
                className="footer__social-icon-img relative w-6 h-6"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block">
                Telegram
              </span>
            </a>
          </li>
          <li className="footer__social-item flex items-center space-x-4 p-2">
            <a
              className="footer__social-icon footer__social-icon--x flex items-center space-x-2"
              href={config.social_media.x._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-x.svg"
                alt={config.social_media.x._alt}
                className="footer__social-icon-img relative w-6 h-6"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block">
                Follow us
              </span>
            </a>
          </li>
          <li className="footer__social-item flex items-center space-x-4 p-2">
            <a
              className="footer__social-icon footer__social-icon--discord flex items-center space-x-2"
              href={config.social_media.discord._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-discord.svg"
                alt={config.social_media.discord._alt}
                className="footer__social-icon-img relative w-6 h-6"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block">
                Join our community
              </span>
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
};
