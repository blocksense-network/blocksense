'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <section
      ref={ref}
      className="hidden md:block relative px-20 pb-8 pt-[4.672rem]"
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
          <section
            className={`flex-1 flex flex-col gap-10 justify-between max-w-[36rem] transition-all duration-[700ms] ease-out ${
              inView
                ? 'opacity-100 translate-x-0 delay-75'
                : 'opacity-0 -translate-x-8'
            }`}
          >
            <h1 className="text-[2.5rem] leading-tight">
              Join the Blocksense <br /> crew with your pirate NFT
            </h1>
            <ClaimNFTButton className="w-fit" />
          </section>
          <p
            className={`flex-1 max-w-[27rem] pt-[0.75rem] transition-all duration-[700ms] ease-out ${
              inView
                ? 'opacity-100 translate-x-0 delay-150'
                : 'opacity-0 translate-x-8'
            }`}
          >
            As the fully programmable ZK oracle protocol with groundbreaking
            cost efficiency, Blocksense will soon let everyone create secure
            oracles in minutes. For every chain and every meta.
            <br />
            <br />
            Become an early adopter by joining the fast-growing Blocksense
            community!
          </p>
        </article>
        <Image
          src={heroPirateFlag}
          alt="Hero Pirate Flag"
          className={`w-full mt-8 transition-all duration-[700ms] ease-out ${
            inView
              ? 'opacity-100 translate-y-0 delay-250'
              : 'opacity-0 translate-y-8'
          }`}
          unoptimized
          priority
          quality={100}
        />
      </section>
    </section>
  );
};

const HeroMobile = () => {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <article
      ref={ref}
      className="md:hidden flex flex-col gap-[2.188rem] px-5 pt-[2.172rem] pb-12"
    >
      <h1
        className={`text-[2rem] transition-all duration-[700ms] ease-out ${
          inView
            ? 'opacity-100 -translate-x-0 delay-75'
            : 'opacity-0 -translate-x-8'
        }`}
      >
        Join the Blocksense <br /> crew with your pirate NFT
      </h1>
      <Image
        src={heroPirateFlagMobile}
        alt="Hero Pirate Flag Mobile"
        className={`mx-auto w-full transition-all duration-[700ms] ease-out ${
          inView
            ? 'opacity-100 -translate-y-0 delay-150'
            : 'opacity-0 -translate-y-8'
        }`}
        unoptimized
        priority
        quality={100}
      />
      <p
        className={`transition-all duration-[700ms] ease-out ${
          inView
            ? 'opacity-100 translate-x-0 delay-250'
            : 'opacity-0 translate-x-8'
        }`}
      >
        As the fully programmable ZK oracle protocol with groundbreaking cost
        efficiency, Blocksense will soon let everyone create secure oracles in
        minutes.
        <br />
        <br />
        Become an early adopter by joining the fast-growing Blocksense
        community!
      </p>
      <div
        className={`transition-all duration-[700ms] ease-out ${
          inView
            ? 'opacity-100 -translate-x-0 delay-350'
            : 'opacity-0 -translate-x-8'
        }`}
      >
        <ClaimNFTButton className="w-full" />
      </div>
    </article>
  );
};
