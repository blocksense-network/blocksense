'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

import { ClaimNFTButton } from './ClaimNFTButton';
import heroVector from '/public/images/hero-vector.svg';
import heroPirateFlag from '/public/images/hero-pirate-flag.png';
import heroPirateFlagMobile from '/public/images/hero-pirate-flag-mobile.png';

export const Hero = () => {
  return (
    <>
      <HeroDesktop />
      <HeroMobile />
    </>
  );
};

const HeroDesktop = () => {
  return (
    <section className="hidden md:block relative px-20 pb-8 pt-[4.672rem]">
      <Image
        src={heroVector}
        alt="Hero Vector"
        fill
        quality={100}
        sizes="100vw"
        className="z-[-1]"
      />
      <section className="max-w-[71.25rem] mx-auto">
        <article className="hero flex gap-[1.625rem] justify-between pb-20">
          <motion.section
            className="flex-1 flex flex-col gap-10 justify-between max-w-[36rem]"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <h1 className="text-[2.5rem] leading-tight">
              Join the Blocksense <br /> crew with your pirate NFT
            </h1>
            <ClaimNFTButton className="w-fit" />
          </motion.section>
          <motion.p
            className="flex-1 max-w-[27rem] pt-[0.75rem]"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            As the fully programmable ZK oracle protocol with groundbreaking
            cost efficiency, Blocksense will soon let everyone create secure
            oracles in minutes. For every chain and every meta.
            <br />
            <br />
            Become an early adopter by joining the fast-growing Blocksense
            community!
          </motion.p>
        </article>
        <motion.div
          className="w-full max-w-[71.25rem] mt-8"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Image
            src={heroPirateFlag}
            alt="Hero Pirate Flag"
            unoptimized
            priority
            quality={100}
          />
        </motion.div>
      </section>
    </section>
  );
};

const HeroMobile = () => {
  return (
    <article className="md:hidden flex flex-col gap-[2.188rem] px-5 pt-[2.172rem] pb-12 overflow-x-hidden">
      <motion.h1
        className="text-[2rem]"
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
      >
        Join the Blocksense <br /> crew with your pirate NFT
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        <Image
          className="mx-auto w-full"
          src={heroPirateFlagMobile}
          alt="Hero Pirate Flag Mobile"
          unoptimized
          priority
          quality={100}
        />
      </motion.div>
      <motion.p
        className=""
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        As the fully programmable ZK oracle protocol with groundbreaking cost
        efficiency, Blocksense will soon let everyone create secure oracles in
        minutes.
        <br />
        <br />
        Become an early adopter by joining the fast-growing Blocksense
        community!
      </motion.p>
      <motion.div
        className=""
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      >
        <ClaimNFTButton className="w-full" />
      </motion.div>
    </article>
  );
};
