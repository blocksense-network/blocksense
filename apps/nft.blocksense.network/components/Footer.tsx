'use client';

import { useState, useEffect, useRef } from 'react';

import { Logo } from './Logo';
import { SocialNetworks } from './SocialNetworks';

const links = [
  { name: 'Blog', href: 'https://blog.blocksense.network/' },
  { name: 'Docs', href: 'https://docs.blocksense.network/' },
  { name: 'How it works', href: 'https://blocksense.network/#howitworks' },
  { name: 'About us', href: 'https://blocksense.network/#about' },
];

export const Footer = () => {
  const footerRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        } else {
          setInView(false);
        }
      },
      {
        threshold: 0.1,
      },
    );

    const element = footerRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <footer
      className="footer text-[var(--white)] px-5 pt-12 pb-12 md:px-20 md:pt-16 md:pb-12"
      role="contentinfo"
      ref={footerRef}
      style={{
        opacity: inView ? 1 : 0,
        transition: 'opacity 0.7s ease-out',
      }}
    >
      <div className="max-w-[66.875rem] mx-auto">
        <section className="footer__top flex flex-col gap-8 md:flex-row md:justify-between md:items-start md:gap-0">
          <header
            className="footer__logo mb-8 md:mb-0"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.7s ease-out, transform 0.7s ease-out 0.4s',
            }}
          >
            <Logo />
          </header>

          <nav
            className="footer__nav"
            aria-label="navigation"
            style={{
              opacity: inView ? 1 : 0,
              transition: 'opacity 0.8s ease-out 0.4s',
            }}
          >
            <ul className="footer__nav-list flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
              {links.map((link, index) => (
                <li
                  className="footer__nav-item"
                  key={link.name}
                  style={{
                    transform: inView ? 'scale(1)' : 'scale(0.8)',
                    transition: `transform 0.4s ease-out ${0.2 + index * 0.1}s`,
                  }}
                >
                  <a
                    href={link.href}
                    className="footer__link hover:opacity-80 transition-opacity duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        <section className="footer__bottom mt-12 flex flex-col gap-8 md:flex-row md:justify-between md:items-center md:gap-0">
          <aside
            className="footer__social-networks self-start md:self-auto md:ml-auto"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.7s ease-out, transform 0.7s ease-out 0.5s',
            }}
          >
            <SocialNetworks />
          </aside>

          <p
            className="footer__copyright not-italic text-sm text-[var(--gray-medium)] md:order-first"
            style={{
              opacity: inView ? 1 : 0,
              transition: 'opacity 0.7s ease-out 0.7s',
            }}
          >
            2025 © Blocksense Network
          </p>
        </section>
      </div>
    </footer>
  );
};
