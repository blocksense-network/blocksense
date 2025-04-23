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
  const [inView, setInView] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
        } else {
          setInView(false);
        }
      },
      { threshold: 0.1 },
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => {
      if (footerRef.current) {
        observer.unobserve(footerRef.current);
      }
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="footer text-[var(--white)] px-5 pt-12 pb-12 md:px-20 md:pt-16 md:pb-12"
      role="contentinfo"
    >
      <div className="max-w-[66.875rem] mx-auto">
        <section className="footer__top flex flex-col gap-8 md:flex-row md:justify-between md:items-start md:gap-0">
          <header
            className={`footer__logo mb-8 md:mb-0 transition-all duration-800 ease-out transform origin-bottom ${
              inView
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-12 scale-90'
            }`}
          >
            <Logo />
          </header>
          <nav className="footer__nav" aria-label="navigation">
            <ul className="footer__nav-list flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
              {links.map((link, i) => (
                <li
                  className={`footer__nav-item transition-all duration-800 ease-out transform origin-bottom ${
                    inView
                      ? `opacity-100 translate-y-0 scale-100 delay-[${(i + 1) * 150}ms]`
                      : 'opacity-0 translate-y-12 scale-90'
                  }`}
                  key={link.name}
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
            className={`footer__social-networks self-start md:self-auto md:ml-auto transition-all duration-800 ease-out transform origin-bottom ${
              inView
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-12 scale-90'
            }`}
          >
            <SocialNetworks />
          </aside>
          <p
            className={`footer__copyright not-italic text-sm text-[var(--gray-medium)] md:order-first transition-all duration-800 ease-out transform origin-bottom ${
              inView
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-12 scale-90'
            }`}
          >
            2025 © Blocksense Network
          </p>
        </section>
      </div>
    </footer>
  );
};
