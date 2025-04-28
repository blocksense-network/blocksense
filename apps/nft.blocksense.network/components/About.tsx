'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

import aboutVector from '/public/images/about-vector.svg';
import bsxParrot from '/public/images/bsx-parrot.png';
import bsxPirate from '/public/images/bsx-pirate.png';
import bsxRobot from '/public/images/bsx-robot.png';
import bsxWarrior from '/public/images/bsx-warrior.png';

import bsxParrotMobile from '/public/images/bsx-parrot-mobile.png';
import bsxRobotMobile from '/public/images/bsx-robot-mobile.png';
import bsxWarriorMobile from '/public/images/bsx-warrior-mobile.png';

export const About = () => {
  return (
    <>
      <AboutDesktop />
      <AboutMobile />
    </>
  );
};

const AboutDesktop = () => {
  return (
    <motion.section
      className="hidden md:block px-20 relative py-[7.75rem]"
      initial="hidden"
      whileInView="visible"
      viewport={{ amount: 0.1 }}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }}
    >
      <Image
        src={aboutVector}
        alt="About Vector"
        fill
        quality={100}
        sizes="100vw"
        className="z-[-1]"
      />
      <section className="about about--desktop max-w-[59.125rem] mx-auto">
        <header className="about__row about__row--top flex justify-between gap-4 items-center mb-[4rem]">
          <motion.section
            className="about__text about__text--left max-w-[28.875rem]"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
          >
            <h2 className="about__title text-[2rem] mb-6">
              What's next for a flag-carrying pirate like you?
            </h2>
            <p className="about__description max-w-[28.75rem]">
              Congrats! Your proof-of-membership pirate NFT should now be in
              your wallet.
              <br />
              <br />
              With this NFT you are officially part of the Blocksense crew. This
              unlocks your gateway into our pirate world of hidden loot and
              limited-edition drops.
              <br />
              <br />
              So, get ready to help us navigate the rough waters of mainnet.
              You’ll have to show your merit but the rewards will be more than
              worth it!
            </p>
          </motion.section>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.36 }}
          >
            <Image
              className="about__image max-w-max"
              src={bsxPirate}
              alt="Pirate NFT"
              quality={100}
              unoptimized
            />
          </motion.div>
        </header>
        <article className="about__row about__row--bottom flex justify-between gap-4 items-center">
          <motion.section
            className="about__gallery max-w-[30.75rem] flex gap-[1.25rem]"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
          >
            <Image
              src={bsxParrot}
              alt="Blocksense Parrot"
              className="about__image max-w-max"
              quality={100}
              unoptimized
            />
            <div className="about__stack flex flex-col gap-[1rem]">
              <Image
                src={bsxWarrior}
                alt="Blocksense Warrior"
                className="about__image max-w-max"
                quality={100}
                unoptimized
              />
              <Image
                src={bsxRobot}
                alt="Blocksense Robot"
                className="about__image max-w-max"
                quality={100}
                unoptimized
              />
            </div>
          </motion.section>
          <motion.aside
            className="about__details max-w-[22.688rem] mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.36 }}
          >
            <p className="about__paragraph">
              <span className="font-bold">HINT:</span> We’re collaborating on a
              unique limited NFT collection with an up-and-coming pop artist who
              has exhibited at the heart of Paris and New York City.
            </p>
          </motion.aside>
        </article>
      </section>
    </motion.section>
  );
};

const AboutMobile = () => {
  return (
    <section className="about about--mobile md:hidden px-5 py-12 flex flex-col gap-12">
      <motion.header
        className="about__text"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.18 }}
      >
        <h2 className="about__title mb-[1.5rem] leading-[120%]">
          What's next for a flag-carrying pirate like you?
        </h2>
        <p className="about__description max-w-[27rem]">
          Congrats! Your proof-of-membership pirate NFT should now be in your
          wallet.
          <br />
          <br />
          With this NFT you are officially part of the Blocksense crew. This
          unlocks your gateway into our pirate world of hidden loot and
          limited-edition drops.
          <br />
          <br />
          So, get ready to help us navigate the rough waters of mainnet. You’ll
          have to show your merit but the rewards will be more than worth it!
        </p>
      </motion.header>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.36 }}
      >
        <Image
          className="about__image w-full"
          src={bsxPirate}
          alt="Pirate NFT Mobile"
          quality={100}
          unoptimized
        />
      </motion.div>
      <motion.footer
        className="about__details"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.18 }}
      >
        <p className="about__paragraph">
          <span className="font-bold">HINT:</span> We’re collaborating on a
          unique limited NFT collection with an up-and-coming pop artist who has
          exhibited at the heart of Paris and New York City.
        </p>
      </motion.footer>
      <motion.div
        className="about__gallery flex flex-col gap-4 w-full"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.36 }}
      >
        <Image
          src={bsxParrotMobile}
          alt="Blocksense Parrot Mobile"
          className="about__image w-full h-auto"
          quality={100}
          unoptimized
        />
        <Image
          src={bsxWarriorMobile}
          alt="Blocksense Warrior Mobile"
          className="about__image w-full h-auto"
          quality={100}
          unoptimized
        />
        <Image
          src={bsxRobotMobile}
          alt="Blocksense Robot Mobile"
          className="about__image w-full h-auto"
          quality={100}
          unoptimized
        />
      </motion.div>
    </section>
  );
};
