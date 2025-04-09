'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

import { Logo } from './Logo';
import { SocialNetworks } from './SocialNetworks';
import { Button } from './Button';
import openIcon from '/public/icons/open.svg';
import closeIcon from '/public/icons/close.svg';

export const Navbar = () => {
  return (
    <>
      <DesktopNavbar />
      <MobileNavbar />
    </>
  );
};

const navLinks = [
  {
    href: 'https://blog.blocksense.network/',
    label: 'Blog',
  },
  {
    href: 'https://docs.blocksense.network/',
    label: 'Docs',
  },
  {
    href: 'https://blocksense.network/#howitworks',
    label: 'How it works',
  },
  {
    href: 'https://blocksense.network/#about',
    label: 'About us',
  },
];

const DesktopNavbar = () => {
  return (
    <header className="navbar hidden md:flex fixed w-full bg-[var(--black)] text-[var(--white)] justify-between items-center px-20 py-[1.125rem]">
      <Logo />
      <nav className="navbar__nav flex gap-8">
        {navLinks.map(link => (
          <a
            key={link.label}
            href={link.href}
            target={'_blank'}
            rel={'noopener noreferrer'}
            className="navbar__link"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
};

const MobileNavbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleMenu = () => {
    setIsOpen(state => !state);
  };

  const closeNavbar = () => {
    setIsOpen(false);
  };

  return (
    <header
      className={`navbar md:hidden ${isOpen && 'text-[var(--white)] flex flex-col h-screen overflow-auto'}`}
    >
      <section className="navbar__header-section fixed w-full bg-[var(--black)] flex justify-between items-center px-5 py-4">
        <Logo />
        <button
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <Image
            src={isOpen ? closeIcon : openIcon}
            alt={isOpen ? 'Close' : 'Open'}
            className={`transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-90' : 'rotate-0'}`}
          />
        </button>
      </section>
      {isOpen && (
        <nav className="navbar__nav flex-1 w-full px-5 py-12 flex flex-col items-center justify-center gap-12 bg-[var(--black)]">
          <section className="flex flex-col gap-8 text-center">
            {navLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target={'_blank'}
                rel={'noopener noreferrer'}
                onClick={closeNavbar}
                className="navbar__link"
              >
                {link.label}
              </a>
            ))}
          </section>
          <Button className="navbar__button w-full">
            Claim your very own pirate NFT
          </Button>
          <SocialNetworks />
        </nav>
      )}
    </header>
  );
};
