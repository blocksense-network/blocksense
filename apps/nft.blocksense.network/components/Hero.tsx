'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { TwitterApi } from 'twitter-api-v2';

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
  const userId = '1055914045544337448';

  const getUserFromGuild = async () => {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${process.env['NEXT_PUBLIC_GUILD_ID']}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${process.env['NEXT_PUBLIC_BOT_TOKEN']}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.json();
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await getUserFromGuild();
      console.log(response);
    };
    fetchUserData();
  }, []);

  // useEffect(() => {
  // const fetchUserData = async () => {
  //   const xToken = process.env['NEXT_PUBLIC_X_TOKEN'];
  //   if (!xToken) {
  //     console.error('NEXT_PUBLIC_X_TOKEN is not defined');
  //     return;
  //   }
  //   const twitterClient = new TwitterApi(xToken);
  //   // Tell typescript it's a readonly app
  //   const readOnlyClient = twitterClient.readOnly;
  //   // Play with the built in methods
  //   const user = await readOnlyClient.v2.userByUsername('r_dimchev');
  //   console.log(user);
  // };
  // fetchUserData();
  // }, []);

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
      <section className="max-w-[66.875rem] mx-auto">
        <article className="hero flex gap-[1.625rem] justify-between pb-20">
          <section className="flex-1 flex flex-col gap-10 justify-between max-w-[36rem]">
            <h1>Join the Blocksense crew with your pirate NFT</h1>
            <Button className="w-fit">Claim your very own pirate NFT</Button>
          </section>
          <p className="flex-1 max-w-[27rem] pt-[0.75rem]">
            As the fully programmable ZK oracle protocol with groundbreaking
            cost efficiency, Blocksense will soon let everyone create secure
            oracles in minutes.
            <br />
            <br />
            Become an early adopter by joining the fast-growing Blocksense
            community!
          </p>
        </article>
        <Image
          src={heroPirateFlag}
          alt="Hero Pirate Flag"
          className="w-full mt-8"
          unoptimized
          priority
          quality={100}
        />
      </section>
    </section>
  );
};

const HeroMobile = () => {
  return (
    <article className="md:hidden flex flex-col gap-[2.188rem] px-5 pt-[2.172rem] pb-12">
      <h1>Join the Blocksense crew with your pirate NFT</h1>
      <Image
        src={heroPirateFlagMobile}
        alt="Hero Pirate Flag Mobile"
        className="mx-auto w-full"
        unoptimized
        priority
        quality={100}
      />
      <p>
        As the fully programmable ZK oracle protocol with groundbreaking cost
        efficiency, Blocksense will soon let everyone create secure oracles in
        minutes.
        <br />
        <br />
        Become an early adopter by joining the fast-growing Blocksense
        community!
      </p>
      <Button className="w-full">Claim your very own pirate NFT</Button>
    </article>
  );
};
