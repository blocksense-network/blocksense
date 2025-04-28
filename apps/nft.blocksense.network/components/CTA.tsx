'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

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

const CTADesktop = () => {
  return (
    <motion.section
      className="cta cta-desktop p-8 hidden md:block"
      initial="hidden"
      whileInView="visible"
      viewport={{ amount: 0.5 }}
      variants={{
        hidden: { opacity: 0, x: -50, scale: 0.95 },
        visible: { opacity: 1, x: 0, scale: 1 },
      }}
      transition={{ duration: 1 }}
    >
      <motion.section
        className="cta-desktop__container bg-[var(--gray-dark)] px-12 py-16 rounded-3xl max-w-[71.25rem] mx-auto relative"
        initial="hidden"
        whileInView="visible"
        variants={{
          hidden: { opacity: 0, x: -50, scale: 0.95 },
          visible: { opacity: 1, x: 0, scale: 1 },
        }}
        transition={{ duration: 1 }}
      >
        <div className="cta__overlay absolute inset-0 bg-gradient-to-b from-[rgba(43,41,41,0)] via-[rgba(43,41,41,0)] to-[rgba(38,38,38,0.7)] z-20" />
        <article className="cta__inner relative flex items-center max-w-[34.9375rem] z-30">
          <motion.section
            className="cta__content flex flex-col justify-center items-start text-left"
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <h1 className="cta__title mb-12">
              The zk rollup for programmable oracles
            </h1>
            <nav
              className="cta__actions flex gap-2"
              aria-label="Call to action"
            >
              <motion.a
                href="https://docs.blocksense.network/"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
              >
                <Button variant="primary" className="cta__button">
                  Start building
                </Button>
              </motion.a>
              <motion.a
                href="https://docs.google.com/forms/d/1rCralOllX5iJAmMaEaIJ41apn5HcbGelIQyK-Nr2Egw/viewform?edit_requested=true"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7 }}
              >
                <Button variant="secondary" className="cta__button">
                  Let’s talk
                </Button>
              </motion.a>
            </nav>
          </motion.section>
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
      </motion.section>
    </motion.section>
  );
};

const CTAMobile = () => {
  return (
    <motion.section
      className="cta cta--mobile md:hidden bg-[var(--gray-dark)] my-12 rounded-2xl mx-5"
      initial="hidden"
      whileInView="visible"
      viewport={{ amount: 0.5 }}
      variants={{
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
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
    </motion.section>
  );
};
