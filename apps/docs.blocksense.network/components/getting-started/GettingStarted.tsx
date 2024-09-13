import React from 'react';

import { gettingStartedConfig } from '@/config';
import { FigureBackdrop } from '@/components/common/FigureBackdrop';
import { LinkButton } from '@/components/common/LinkButton';

export const GettingStarted = () => {
  return (
    <section className="getting-started pt-[10rem] md:pt-[20rem] lg:pt-[20rem] mx-auto w-full flex flex-col items-center">
      <section className="getting-started__content-holder px-4 lg:gap-8 xl:gap-0">
        <article className="getting-started__content flex flex-col justify-center items-start gap-4 lg:gap-4">
          <h1 className="getting-started__title tracking-tight text-3xl md:text-4xl lg:text-5xl dark:text-white max-w-screen-xl">
            {gettingStartedConfig.title}
          </h1>
          <p className="getting-started__description max-bs-2xl font-noto-sans-thin text-gray-900 contrast-125 dark:text-white md:text-lg lg:text-xl">
            {gettingStartedConfig.description}
          </p>
          <div className="flex flex-wrap mt-2">
            <LinkButton
              href="/docs/overview/getting-started"
              label="Get Started"
            />
            <LinkButton
              href="/docs/overview/roadmap"
              label="Roadmap"
              className="hidden"
            />
          </div>
        </article>
        <aside className="getting-started__image flex-row-reverse hidden md:flex md:mt-0 lg:mt-0 lg:flex">
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
