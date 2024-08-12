import React from 'react';

import { gettingStartedConfig } from '@/config';
import { FigureBackdrop } from '@/components/common/FigureBackdrop';
import { LinkButton } from '@/components/common/LinkButton';

export const GettingStarted = () => {
  return (
    <section className="getting-started relative isolate px-6 pt-14 lg:px-8">
      <section className="getting-started__content-holder mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 flex items-center px-4 lg:gap-8 xl:gap-0">
        <article className="getting-started__content mr-auto place-self-center lg:col-span-7">
          <h1 className="getting-started__title max-w-2xl mb-4 text-4xl font-noto-sans-extra-bold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white">
            {gettingStartedConfig.title}
          </h1>
          <p className="getting-started__description max-w-2xl mb-6 font-noto-sans-thin text-gray-900 lg:mb-8 md:text-lg lg:text-xl">
            {gettingStartedConfig.description}
          </p>
          <span className="lg:ml-auto">
            <LinkButton
              href="/docs/overview/getting-started"
              label="Get Started"
            ></LinkButton>
            <LinkButton
              href="/docs/overview/roadmap"
              label="Roadmap"
            ></LinkButton>
          </span>
        </article>
        <aside className="getting-started__image hidden lg:mt-0 lg:col-span-3 lg:flex">
          <img
            className="getting-started__image-content"
            src="/images/blocksense-fig.jpg"
            alt="Blocksense figurine"
            width={250}
            height={280}
            loading="lazy"
          />
        </aside>
      </section>
      <FigureBackdrop />
    </section>
  );
};
