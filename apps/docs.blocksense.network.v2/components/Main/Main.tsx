import React from 'react';

import { gettingStartedConfig } from '@/config';
import { LinkButton } from '@/components/common/LinkButton';

export const Main = () => {
  return (
    <section className="getting-started w-full flex h-[calc(100%_+_5rem)] bg-[url('/images/blocksense-bg.jpg')] bg-cover bg-center bg-no-repeat">
      <article className="getting-started__content flex flex-col justify-center items-start gap-4">
        <h1 className="getting-started__title tracking-tight text-3xl md:text-4xl lg:text-5xl dark:text-white max-w-screen-xl">
          {gettingStartedConfig.title}
        </h1>
        <p className="getting-started__description max-bs-2xl font-noto-sans-thin text-gray-900 contrast-125 dark:text-white md:text-lg lg:text-xl">
          {gettingStartedConfig.description}
        </p>
        <div className="flex flex-wrap mt-2">
          <LinkButton href="/docs/overview/introduction" label="Get Started" />
          <LinkButton
            href="/docs/overview/roadmap"
            label="Roadmap"
            className="hidden"
          />
        </div>
      </article>
    </section>
  );
};
