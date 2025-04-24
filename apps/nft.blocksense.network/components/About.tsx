'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [inView, setInView] = useState(false);
  const desktopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { threshold: 0.1 },
    );

    if (desktopRef.current) observer.observe(desktopRef.current);

    return () => {
      if (desktopRef.current) observer.unobserve(desktopRef.current);
    };
  }, []);

  return (
    <section
      ref={desktopRef}
      className="hidden md:block px-20 relative py-[7.75rem]"
    >
      <Image
        src={aboutVector}
        alt="About Vector"
        fill
        quality={100}
        sizes="100vw"
        className="z-[-1]"
      />
      <section className="about about--desktop max-w-[58.5rem] mx-auto">
        <header
          className={`about__row about__row--top flex justify-between gap-4 items-center mb-[4rem] transition-all duration-800 ease-out transform origin-bottom ${
            inView
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-12 scale-95'
          }`}
        >
          <section
            className={`about__text about__text--left max-w-[36rem] transition-all duration-800 ease-out ${
              inView
                ? 'delay-[180ms] opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
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
          </section>
          <Image
            src={bsxPirate}
            alt="Pirate NFT"
            className={`about__image max-w-max transition-all duration-800 ease-out ${
              inView
                ? 'delay-[350ms] opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
            quality={100}
            unoptimized
          />
        </header>
        <article className="about__row about__row--bottom flex justify-between gap-4 items-center">
          <section
            className={`about__gallery max-w-[30.75rem] flex gap-[1.25rem] transition-all duration-800 ease-out ${
              inView
                ? 'delay-[500ms] opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
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
          </section>
          <aside
            className={`about__details max-w-[22.688rem] mx-auto transition-all duration-800 ease-out ${
              inView
                ? 'delay-[650ms] opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            <p className="about__paragraph">
              <span className="font-bold">HINT:</span> We’re collaborating on a
              unique limited NFT collection with an up-and-coming pop artist who
              has exhibited at the heart of Paris and New York City.
            </p>
          </aside>
        </article>
      </section>
    </section>
  );
};

const AboutMobile = () => {
  const [inView, setInView] = useState(false);
  const mobileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { threshold: 0.1 },
    );

    if (mobileRef.current) observer.observe(mobileRef.current);

    return () => {
      if (mobileRef.current) observer.unobserve(mobileRef.current);
    };
  }, []);

  return (
    <section
      ref={mobileRef}
      className="about about--mobile md:hidden px-5 py-12 flex flex-col gap-12"
    >
      <header
        className={`about__text transition-all duration-800 ease-out ${
          inView
            ? 'opacity-100 translate-y-0 delay-[180ms]'
            : 'opacity-0 translate-y-6'
        }`}
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
      </header>
      <Image
        src={bsxPirate}
        alt="Pirate NFT Mobile"
        className={`about__image w-full transition-all duration-800 ease-out ${
          inView
            ? 'opacity-100 translate-y-0 delay-[350ms]'
            : 'opacity-0 translate-y-6'
        }`}
        quality={100}
        unoptimized
      />
      <footer
        className={`about__details transition-all duration-800 ease-out ${
          inView
            ? 'opacity-100 translate-y-0 delay-[500ms]'
            : 'opacity-0 translate-y-6'
        }`}
      >
        <p className="about__paragraph">
          <span className="font-bold">HINT:</span> We’re collaborating on a
          unique limited NFT collection with an up-and-coming pop artist who has
          exhibited at the heart of Paris and New York City.
        </p>
      </footer>
      <div
        className={`about__gallery flex flex-col gap-4 w-full transition-all duration-800 ease-out ${
          inView
            ? 'opacity-100 translate-y-0 delay-[650ms]'
            : 'opacity-0 translate-y-6'
        }`}
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
      </div>
    </section>
  );
};
