'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

import { Logo } from './Logo';
import { ClaimNFTButton } from './ClaimNFTButton';
import { SocialNetworks } from './SocialNetworks';
import openIcon from '/public/icons/open.svg';
import closeIcon from '/public/icons/close.svg';

const navLinks = [
  { href: 'https://blog.blocksense.network/', label: 'Blog' },
  { href: 'https://docs.blocksense.network/', label: 'Docs' },
  { href: 'https://blocksense.network/#howitworks', label: 'How it works' },
  { href: 'https://blocksense.network/#about', label: 'About us' },
];

const animationProps = {
  initial: { opacity: 0, y: -20, scale: 0.9 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.8 },
};

export const Navbar = () => {
  return (
    <>
      <DesktopNavbar />
      <MobileNavbar />
    </>
  );
};

const DesktopNavbar = () => {
  return (
    <motion.header
      className="navbar hidden md:flex bg-[var(--black)/0.85] backdrop-blur-2xl z-10 fixed w-full text-[var(--white)] px-20 py-[1.125rem]"
      {...animationProps}
    >
      <div className="w-full max-w-[71.25rem] mx-auto z-30 flex justify-between items-center">
        <motion.div {...animationProps}>
          <Logo />
        </motion.div>
        <nav className="navbar__nav flex gap-8">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="navbar__link"
              {...animationProps}
              transition={{
                ...animationProps.transition,
                delay: (i + 1) * 0.15,
              }}
            >
              {link.label}
            </motion.a>
          ))}
        </nav>
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

  const toggleMenu = () => setIsOpen(prevState => !prevState);
  const closeNavbar = () => setIsOpen(false);

  return (
    <header className="navbar md:hidden relative">
      <section className="navbar__header-section fixed top-0 w-full bg-[var(--black)] flex justify-between items-center px-5 py-4 z-50">
        <motion.div {...animationProps}>
          <Logo />
        </motion.div>
        <motion.div
          {...animationProps}
          transition={{
            ...animationProps.transition,
            delay: 0.3,
          }}
        >
          <button
            onClick={toggleMenu}
            aria-expanded={isOpen}
            aria-label={
              isOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
          >
            <Image
              src={isOpen ? closeIcon : openIcon}
              alt={isOpen ? 'Close' : 'Open'}
              className={`transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-90' : 'rotate-0'}`}
            />
          </button>
        </motion.div>
      </section>
      {isOpen && (
        <motion.nav
          className="fixed top-[3.85rem] left-0 w-full h-[calc(100vh-3.85rem)] px-5 py-12 flex flex-col items-center justify-center gap-12 bg-[var(--black)] overflow-auto z-50"
          {...animationProps}
        >
          <section className="flex flex-col gap-8 text-center w-full">
            {navLinks.map((link, i) => (
              <motion.a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeNavbar}
                className="navbar__link"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                }}
              >
                {link.label}
              </motion.a>
            ))}
          </section>
          <motion.div
            className="navbar__button w-full flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <ClaimNFTButton onClick={closeNavbar} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <SocialNetworks />
          </motion.div>
        </motion.nav>
      )}
    </header>
  );
};
