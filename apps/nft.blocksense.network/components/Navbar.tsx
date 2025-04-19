'use client';

import { useState, useEffect, useRef } from 'react';
import * as motion from 'motion/react-client';
import Image from 'next/image';

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
  const navbarRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    if (navbarRef.current) {
      observer.observe(navbarRef.current);
    }

    return () => {
      if (navbarRef.current) observer.disconnect();
    };
  }, []);

  return (
    <motion.header
      ref={navbarRef}
      className="navbar hidden md:flex bg-[var(--black)/0.85] backdrop-blur-2xl z-10 fixed w-full text-[var(--white)] px-20 py-[1.125rem]"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : -30 }}
      transition={{
        duration: 0.7,
        ease: 'easeOut',
      }}
    >
      <div className="w-full max-w-[66.875rem] mx-auto z-30 flex justify-between items-center">
        <Logo />
        <motion.nav
          className="navbar__nav flex gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{
            duration: 0.8,
            delay: 0.4,
            ease: 'easeOut',
          }}
        >
          {navLinks.map(link => (
            <motion.a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="navbar__link hover:opacity-80 transition-opacity duration-200"
              initial={{ scale: 0.8 }}
              animate={{ scale: inView ? 1 : 0.8 }}
              transition={{
                duration: 0.4,
                delay: 0.2,
                ease: 'easeOut',
              }}
            >
              {link.label}
            </motion.a>
          ))}
        </motion.nav>
      </div>
    </motion.header>
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
    <header className="navbar md:hidden relative z-50">
      <section className="navbar__header-section fixed top-0 w-full bg-[var(--black)] flex justify-between items-center px-5 py-4 z-20">
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
        <motion.nav
          className="fixed top-[3.85rem] left-0 w-full h-[calc(100vh-3.85rem)] px-5 py-12 flex flex-col items-center justify-center gap-12 bg-[var(--black)] overflow-auto"
          initial={{ opacity: 0, x: -200 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.5,
            ease: 'easeOut',
          }}
        >
          <motion.section
            className="flex flex-col gap-8 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.3,
              ease: 'easeOut',
            }}
          >
            {navLinks.map(link => (
              <motion.a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeNavbar}
                className="navbar__link hover:opacity-80 active:opacity-80 transition-opacity duration-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.3,
                  delay: 0.2,
                }}
              >
                {link.label}
              </motion.a>
            ))}
          </motion.section>
          <Button className="navbar__button w-full">
            Claim your very own pirate NFT
          </Button>
          <SocialNetworks />
        </motion.nav>
      )}
    </header>
  );
};
