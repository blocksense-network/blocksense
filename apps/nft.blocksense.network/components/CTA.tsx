import Image from 'next/image';

import { Button } from 'components/Button';
import bgCtaDesktop from '/public/images/bg-cta-desktop.png';
import bgCtaMobile from '/public/images/bg-cta-mobile.png';

export const CTA = () => {
  return (
    <>
      <CTADesktop />
      <CTAMobile />
    </>
  );
};

const CTADesktop = () => {
  return (
    <section className="cta cta-desktop p-8 hidden md:block">
      <section className="cta-desktop__container bg-[var(--gray-dark)] px-12 py-16 rounded-3xl max-w-[76.875rem] mx-auto relative">
        <div className="cta__overlay absolute inset-0 bg-gradient-to-b from-[rgba(43,41,41,0)] z-20 via-[rgba(43,41,41,0)] to-[rgba(38,38,38,0.7)]" />
        <article className="cta__inner relative flex items-center max-w-[34.9375rem] z-30">
          <section className="cta__content flex flex-col justify-center items-start text-left">
            <h1 className="cta__title mb-12">
              The zk rollup for programmable oracles
            </h1>
            <nav
              className="cta__actions flex gap-2"
              aria-label="Call to action"
            >
              <a
                href="https://docs.blocksense.network/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="primary" className="cta__button">
                  Start building
                </Button>
              </a>
              <a
                href="https://docs.google.com/forms/d/1rCralOllX5iJAmMaEaIJ41apn5HcbGelIQyK-Nr2Egw/viewform?edit_requested=true"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="cta__button">
                  Let’s talk
                </Button>
              </a>
            </nav>
          </section>
        </article>
        <Image
          src={bgCtaDesktop}
          alt="CTA Background"
          priority
          className="object-scale-down object-right-top z-10"
          fill
          quality={100}
          unoptimized
        />
      </section>
    </section>
  );
};

const CTAMobile = () => {
  return (
    <section className="cta cta--mobile md:hidden bg-[var(--gray-dark)] my-12 rounded-2xl mx-5">
      <article className="cta__inner relative flex flex-col gap-8 px-4 pt-8">
        <h1 className="cta__title text-center">
          The zk rollup for programmable oracles
        </h1>
        <nav
          className="cta__actions w-full flex flex-col gap-2"
          aria-label="Call to action"
        >
          <a
            href="https://docs.blocksense.network/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="primary" className="cta__button w-full">
              Start building
            </Button>
          </a>
          <a
            href="https://docs.google.com/forms/d/1rCralOllX5iJAmMaEaIJ41apn5HcbGelIQyK-Nr2Egw/viewform?edit_requested=true"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" className="cta__button w-full">
              Let’s talk
            </Button>
          </a>
        </nav>
      </article>
      <Image
        src={bgCtaMobile}
        alt="CTA Background Mobile"
        priority
        className="object-cover w-full rounded-b-2xl"
        quality={100}
        unoptimized
      />
    </section>
  );
};
