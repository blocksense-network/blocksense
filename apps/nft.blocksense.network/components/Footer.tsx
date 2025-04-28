'use client';

import { motion } from 'motion/react';

import { Logo } from './Logo';
import { SocialNetworks } from './SocialNetworks';

const links = [
  { name: 'Blog', href: 'https://blog.blocksense.network/' },
  { name: 'Docs', href: 'https://docs.blocksense.network/' },
  { name: 'How it works', href: 'https://blocksense.network/#howitworks' },
  { name: 'About us', href: 'https://blocksense.network/#about' },
];

const animationProps = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.8 },
};

export const Footer = () => {
  return (
    <footer
      className="footer text-[var(--white)] px-5 pt-12 pb-12 md:px-20 md:pt-16 md:pb-12"
      role="contentinfo"
    >
      <div className="max-w-[71.25rem] mx-auto">
        <section className="footer__top flex flex-col gap-8 md:flex-row md:justify-between md:items-start md:gap-0">
          <motion.header
            className="footer__logo mb-8 md:mb-0"
            {...animationProps}
          >
            <Logo />
          </motion.header>
          <nav className="footer__nav" aria-label="navigation">
            <ul className="footer__nav-list flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
              {links.map((link, i) => (
                <motion.li
                  className="footer__nav-item"
                  key={link.name}
                  {...animationProps}
                  transition={{
                    ...animationProps.transition,
                    delay: (i + 1) * 0.15,
                  }}
                >
                  <a
                    href={link.href}
                    className="footer__link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.name}
                  </a>
                </motion.li>
              ))}
            </ul>
          </nav>
        </section>
        <section className="footer__bottom mt-12 flex flex-col gap-8 md:flex-row md:justify-between md:items-center md:gap-0">
          <motion.aside
            className="footer__social-networks self-start md:self-auto md:ml-auto"
            {...animationProps}
          >
            <SocialNetworks />
          </motion.aside>
          <motion.p
            className="footer__copyright not-italic text-sm text-[var(--gray-medium)] md:order-first"
            {...animationProps}
          >
            2025 © Blocksense Network
          </motion.p>
        </section>
      </div>
    </footer>
  );
};
