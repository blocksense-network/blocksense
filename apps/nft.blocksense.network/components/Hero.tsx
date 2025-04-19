import Image from 'next/image';
import * as motion from 'motion/react-client';

import { Button } from './Button';
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
    <motion.section
      className="hidden md:block relative px-20 pb-8 pt-[4.672rem] overflow-hidden"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.75,
        ease: [0.25, 1, 0.5, 1],
      }}
    >
      <Image
        src={heroVector}
        alt="Hero Vector"
        fill
        quality={100}
        sizes="100vw"
        className="z-[-1]"
      />
      <section className="max-w-[66.875rem] mx-auto">
        <article className="hero flex gap-[1.625rem] justify-between pb-20">
          <motion.section
            className="flex-1 flex flex-col gap-10 justify-between max-w-[36rem]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.75,
              ease: [0.25, 1, 0.5, 1],
              scale: { type: 'spring', stiffness: 200, damping: 20 },
            }}
          >
            <h1>Join the Blocksense crew with your pirate NFT</h1>
            <Button className="w-fit">Claim your very own pirate NFT</Button>
          </motion.section>
          <motion.p
            className="flex-1 max-w-[27rem] pt-[0.75rem]"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.75,
              ease: [0.25, 1, 0.5, 1],
              delay: 0.5,
            }}
          >
            As the fully programmable ZK oracle protocol with groundbreaking
            cost efficiency, Blocksense will soon let everyone create secure
            oracles in minutes.
            <br />
            <br />
            Become an early adopter by joining the fast-growing Blocksense
            community!
          </motion.p>
        </article>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 0 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: -15,
          }}
          transition={{
            duration: 1.2,
            ease: [0.25, 1, 0.5, 1],
            delay: 0.6,
            scale: { type: 'spring', stiffness: 300, damping: 25 },
            y: { type: 'spring', stiffness: 300, damping: 25 },
          }}
        >
          <Image
            src={heroPirateFlag}
            alt="Hero Pirate Flag"
            className="w-full mt-8"
            unoptimized
            priority
            quality={100}
          />
        </motion.div>
      </section>
    </motion.section>
  );
};

const HeroMobile = () => {
  return (
    <motion.article
      className="md:hidden flex flex-col gap-[2.188rem] px-5 pt-[2.172rem] pb-12 overflow-hidden"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.75,
        ease: [0.25, 1, 0.5, 1],
      }}
    >
      <h1>Join the Blocksense crew with your pirate NFT</h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 0 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: -15,
        }}
        transition={{
          duration: 1.2,
          ease: [0.25, 1, 0.5, 1],
          delay: 0.6,
          scale: { type: 'spring', stiffness: 300, damping: 25 },
          y: { type: 'spring', stiffness: 300, damping: 25 },
        }}
      >
        <Image
          src={heroPirateFlagMobile}
          alt="Hero Pirate Flag Mobile"
          className="mx-auto w-full"
          unoptimized
          priority
          quality={100}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: 0.75,
          ease: [0.25, 1, 0.5, 1],
          delay: 0.8,
        }}
      >
        As the fully programmable ZK oracle protocol with groundbreaking cost
        efficiency, Blocksense will soon let everyone create secure oracles in
        minutes.
        <br />
        <br />
        Become an early adopter by joining the fast-growing Blocksense
        community!
      </motion.p>
      <Button className="w-full">Claim your very own pirate NFT</Button>
    </motion.article>
  );
};
