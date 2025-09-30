import React from 'react';

import { ImageWrapper } from '@blocksense/docs-ui/ImageWrapper';
import { config } from '@/config';

export const Footer = () => {
  return (
    <footer className="footer mx-auto flex items-center justify-between mt-10 md:mt-12 h-20 nx-h-[var(--nextra-navbar-height)] nx-max-w-[90rem] p-4 nx-gap-2 nx-pl-[max(env(safe-area-inset-left),1.5rem)] nx-pr-[max(env(safe-area-inset-right),1.5rem)]">
      <aside className="footer__link flex items-center space-x-2">
        <a
          href="https://blocksense.network/lets-talk"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/icons/lets-talk.svg"
            alt="Let's talk"
            className="footer__social-icon-img relative invert w-8 h-8"
          />
        </a>
      </aside>
      <nav className="footer__social-nav flex items-center">
        <ul className="footer__social-list flex gap-4">
          <li className="footer__social-item flex items-center space-x-2">
            <a
              className="footer__social-icon footer__social-icon--telegram flex items-center space-x-2"
              href={config.social_media.telegram._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-telegram.svg"
                alt={config.social_media.telegram._alt}
                className="footer__social-icon-img relative w-6 h-6 invert"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block dark:text-neutral-200">
                Telegram
              </span>
            </a>
          </li>
          <li className="footer__social-item flex items-center space-x-2">
            <a
              className="footer__social-icon footer__social-icon--x flex items-center space-x-2"
              href={config.social_media.x._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-x.svg"
                alt={config.social_media.x._alt}
                className="footer__social-icon-img relative w-6 h-6 invert"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block dark:text-neutral-200">
                Follow us
              </span>
            </a>
          </li>
          <li className="footer__social-item flex items-center space-x-2">
            <a
              className="footer__social-icon footer__social-icon--discord flex items-center space-x-2"
              href={config.social_media.discord._href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImageWrapper
                src="/icons/blocksense-discord.svg"
                alt={config.social_media.discord._alt}
                className="footer__social-icon-img relative w-6 h-6 invert"
              />
              <span className="footer__social-label font-semibold text-gray-900 hidden lg:block dark:text-neutral-200">
                Join our community
              </span>
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
};
