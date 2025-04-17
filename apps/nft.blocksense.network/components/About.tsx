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

const bsxAssets = {
  pirate: { src: bsxPirate, alt: 'Pirate NFT' },
  parrot: { src: bsxParrot, alt: 'BSX Parrot' },
  robot: { src: bsxRobot, alt: 'BSX Robot' },
  warrior: { src: bsxWarrior, alt: 'BSX Warrior' },
};

const bsxMobileAssets = {
  pirate: { src: bsxPirate, alt: 'Pirate NFT Mobile' },
  parrot: { src: bsxParrotMobile, alt: 'BSX Parrot Mobile' },
  robot: { src: bsxRobotMobile, alt: 'BSX Robot Mobile' },
  warrior: { src: bsxWarriorMobile, alt: 'BSX Warrior Mobile' },
};

const AboutDesktop = () => {
  return (
    <section className="hidden md:block px-20 relative pt-[7.75rem] pb-[7.75rem]">
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
            <h2 className="about__title about__title--primary text-3xl font-bold mb-[1.5rem]">
              What the pirate NFT gives you:
            </h2>
            <p className="about__description about__description--primary max-w-[27rem]">
              Congrats! Your proof-of-membership pirate NFT should now be in
              your wallet.
            </p>
            <br />
            <p className="about__description about__description--secondary max-w-[27rem]">
              Once you mint the first NFT, you officially join the Blocksense
              crew — your gateway into our pirate world and your key to
              exclusive drops like the upcoming second one.
            </p>
          </section>
          <Image
            src={bsxAssets.pirate.src}
            alt={bsxAssets.pirate.alt}
            className="about__image about__image--desktop"
            quality={100}
            unoptimized
          />
        </header>
        <article className="about__row about__row--bottom flex gap-4 items-center">
          <section className="about__gallery about__gallery--desktop max-w-[30.5rem] flex gap-[1rem]">
            <Image
              src={bsxAssets.parrot.src}
              alt={bsxAssets.parrot.alt}
              className="about__image about__image--desktop"
              quality={100}
              unoptimized
            />
            <div className="about__stack about__stack--vertical flex flex-col gap-[1rem]">
              <Image
                src={bsxAssets.robot.src}
                alt={bsxAssets.robot.alt}
                className="about__image about__image--desktop"
                quality={100}
                unoptimized
              />
              <Image
                src={bsxAssets.warrior.src}
                alt={bsxAssets.warrior.alt}
                className="about__image about__image--desktop"
                quality={100}
                unoptimized
              />
            </div>
          </section>
          <aside className="about__details about__details--text max-w-[21rem] mx-auto">
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
    <section className="about about--mobile md:hidden px-5 pt-[2.5rem] pb-[3rem] flex flex-col gap-[2.5rem]">
      <header className="about__text about__text--mobile">
        <h2 className="about__title about__title--mobile font-bold mb-[1.5rem] text-[1.25rem] leading-tight">
          What the pirate NFT gives you:
        </h2>
        <p className="about__description about__description--mobile text-base leading-relaxed">
          Congrats! Your proof-of-membership pirate NFT should now be in your
          wallet.
        </p>
        <br />
        <p className="about__description about__description--mobile__secondary max-w-[27rem]">
          Once you mint the first NFT, you officially join the Blocksense crew —
          your gateway into our pirate world and your key to exclusive drops
          like the upcoming second one.
        </p>
      </header>
      <div className="about__image-container about__image-container--mobile flex justify-center">
        <Image
          src={bsxMobileAssets.pirate.src}
          alt={bsxMobileAssets.pirate.alt}
          className="about__image about__image--rounded"
          quality={100}
          unoptimized
        />
      </div>
      <footer className="about__details about__details--mobile flex flex-col gap-[1rem] pt-[0.5rem]">
        <p className="about__paragraph about__paragraph--mobile text-base leading-relaxed">
          HINT: It will be a unique collection of NFTs by a famous artist. We
          can’t divulge any more details now, but trust us, it will be worth it.
        </p>
      </footer>
      <div className="about__gallery about__gallery--mobile flex flex-col gap-4 w-full">
        <div className="about__image-item about__image-item--mobile w-full">
          <Image
            src={bsxMobileAssets.parrot.src}
            alt={bsxMobileAssets.parrot.alt}
            className="about__image about__image--rounded w-full h-auto"
            quality={100}
            unoptimized
          />
        </div>
        <div className="about__image-item about__image-item--mobile w-full">
          <Image
            src={bsxMobileAssets.robot.src}
            alt={bsxMobileAssets.robot.alt}
            className="about__image about__image--rounded w-full h-auto"
            quality={100}
            unoptimized
          />
        </div>
        <div className="about__image-item about__image-item--mobile w-full">
          <Image
            src={bsxMobileAssets.warrior.src}
            alt={bsxMobileAssets.warrior.alt}
            className="about__image about__image--rounded w-full h-auto"
            quality={100}
            unoptimized
          />
        </div>
      </div>
    </section>
  );
};
