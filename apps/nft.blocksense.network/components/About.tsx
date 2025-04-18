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
    <section className="hidden md:block px-20 relative py-[7.75rem]">
      <Image
        src={aboutVector}
        alt="About Vector"
        fill
        quality={100}
        sizes="100vw"
        className="z-[-1]"
      />
      <section className="about about--desktop max-w-[58.5rem] mx-auto">
        <header className="about__row about__row--top flex justify-between gap-4 items-center mb-[4rem]">
          <section className="about__text about__text--left max-w-[36rem]">
            <h2 className="about__title about__title--primary text-[2rem] mb-6">
              What the pirate NFT gives you:
            </h2>
            <p className="about__description about__description--primary max-w-[28.75rem]">
              Congrats! Your proof-of-membership pirate NFT should now be in
              your wallet.
              <br />
              <br />
              Once you mint the first NFT, you officially join the Blocksense
              crew — your gateway into our pirate world and your key to
              exclusive drops like the upcoming second one.
            </p>
          </section>
          <Image
            src={bsxPirate}
            alt="Pirate NFT"
            className="about__image about__image--desktop max-w-max"
            quality={100}
            unoptimized
          />
        </header>
        <article className="about__row about__row--bottom flex justify-between gap-4 items-center">
          <section className="about__gallery about__gallery--desktop max-w-[30.75rem] flex gap-[1.25rem]">
            <Image
              src={bsxParrot}
              alt="Blocksense Parrot"
              className="about__image about__image--desktop max-w-max"
              quality={100}
              unoptimized
            />
            <div className="about__stack about__stack--vertical flex flex-col gap-[1rem]">
              <Image
                src={bsxWarrior}
                alt="Blocksense Warrior"
                className="about__image about__image--desktop max-w-max"
                quality={100}
                unoptimized
              />
              <Image
                src={bsxRobot}
                alt="Blocksense Robot"
                className="about__image about__image--desktop max-w-max"
                quality={100}
                unoptimized
              />
            </div>
          </section>
          <aside className="about__details about__details--text max-w-[22.688rem] mx-auto">
            <p className="about__paragraph about__paragraph--primary">
              HINT: It will be a unique collection of NFTs by a famous artist.
              We can’t divulge any more details now, but trust us, it will be
              worth it.
            </p>
          </aside>
        </article>
      </section>
    </section>
  );
};

const AboutMobile = () => {
  return (
    <section className="about about--mobile md:hidden px-5 py-12 flex flex-col gap-12">
      <header className="about__text about__text--mobile">
        <h2 className="about__title about__title--mobile mb-[1.5rem] leading-[120%]">
          What the pirate NFT gives you:
        </h2>
        <p className="about__description about__description--mobile">
          Congrats! Your proof-of-membership pirate NFT should now be in your
          wallet.
        </p>
        <br />
        <br />
        <p className="about__description about__description--mobile__secondary max-w-[27rem]">
          Once you mint the first NFT, you officially join the Blocksense crew —
          your gateway into our pirate world and your key to exclusive drops
          like the upcoming second one.
        </p>
      </header>
      <Image
        src={bsxPirate}
        alt="Pirate NFT Mobile"
        className="about__image about__image--rounded w-full"
        quality={100}
        unoptimized
      />
      <footer className="about__details about__details--mobile">
        <p className="about__paragraph about__paragraph--mobile">
          HINT: It will be a unique collection of NFTs by a famous artist. We
          can’t divulge any more details now, but trust us, it will be worth it.
        </p>
      </footer>
      <div className="about__gallery about__gallery--mobile flex flex-col gap-4 w-full">
        <Image
          src={bsxParrotMobile}
          alt="Blocksense Parrot Mobile"
          className="about__image about__image--rounded w-full h-auto"
          quality={100}
          unoptimized
        />
        <Image
          src={bsxWarriorMobile}
          alt="Blocksense Warrior Mobile"
          className="about__image about__image--rounded w-full h-auto"
          quality={100}
          unoptimized
        />
        <Image
          src={bsxRobotMobile}
          alt="Blocksense Robot Mobile"
          className="about__image about__image--rounded w-full h-auto"
          quality={100}
          unoptimized
        />
      </div>
    </section>
  );
};
