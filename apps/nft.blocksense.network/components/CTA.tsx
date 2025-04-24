'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { Button } from 'components/Button';
import bgCtaDesktop from '/public/images/bg-cta-desktop.png';

export const CTA = () => {
  return (
    <>
      <CTADesktop />
      <CTAMobile />
    </>
  );
};

const useRevealOnView = (threshold = 0.5) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) {
          setShow(entry.isIntersecting);
        }
      },
      { threshold },
    );

    const currentRef = ref.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [threshold]);

  return { ref, show };
};

const CTADesktop = () => {
  const { ref, show } = useRevealOnView();

  return (
    <section ref={ref} className="cta cta-desktop p-8 hidden md:block">
      <section
        className={`cta-desktop__container bg-[var(--gray-dark)] px-12 py-16 rounded-3xl max-w-[71.25rem] mx-auto relative transition-all duration-1000 ease-out transform will-change-transform ${
          show
            ? 'opacity-100 translate-x-0 scale-100'
            : 'opacity-0 -translate-x-12 scale-95'
        }`}
      >
        <div className="cta__overlay absolute inset-0 bg-gradient-to-b from-[rgba(43,41,41,0)] via-[rgba(43,41,41,0)] to-[rgba(38,38,38,0.7)] z-20" />
        <article className="cta__inner relative flex items-center max-w-[34.9375rem] z-30">
          <section
            className={`cta__content flex flex-col justify-center items-start text-left transition-all duration-1000 ease-out transform will-change-transform ${
              show
                ? 'opacity-100 translate-x-0 scale-100'
                : 'opacity-0 translate-x-8 scale-95'
            }`}
          >
            <h1
              className={`cta__title mb-12 transition-all duration-1000 ease-out ${
                show
                  ? 'opacity-100 translate-x-0 scale-100'
                  : 'opacity-0 translate-x-4 scale-95'
              }`}
            >
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
                <Button
                  variant="primary"
                  className={`cta__button transition-all duration-700 ease-in-out transform ${
                    show
                      ? 'opacity-100 scale-100 translate-x-0'
                      : 'opacity-0 -translate-x-10 scale-95'
                  }`}
                >
                  Start building
                </Button>
              </a>
              <a
                href="https://docs.google.com/forms/d/1rCralOllX5iJAmMaEaIJ41apn5HcbGelIQyK-Nr2Egw/viewform?edit_requested=true"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="secondary"
                  className={`cta__button transition-all duration-700 ease-in-out transform ${
                    show
                      ? 'opacity-100 scale-100 translate-x-0'
                      : 'opacity-0 -translate-x-10 scale-95'
                  }`}
                >
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
  const { ref, show } = useRevealOnView();

  return (
    <section
      ref={ref}
      className={`cta cta--mobile md:hidden bg-[var(--gray-dark)] my-12 rounded-2xl mx-5 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] transform will-change-transform ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <article className="cta__inner relative flex flex-col gap-8 px-4 pt-8 z-20">
        <h1 className="cta__title text-center">
          The zk rollup for programmable oracles
        </h1>
        <nav
          className="cta__actions w-full flex flex-col gap-4"
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
        src={bgCtaDesktop}
        alt="CTA Background Mobile"
        priority
        quality={100}
        className="object-cover mt-[-3rem]"
        unoptimized
      />
    </section>
  );
};
