import type { Metadata } from 'next';
import type { FC } from 'react';

import { gettingStartedConfig } from '@/config';
import { Button } from '@blocksense/docs-ui/Button';

export const metadata: Metadata = {
  title: 'Home',
};

const IndexPage: FC = () => {
  return (
    <section className="getting-started px-6 w-full flex items-center min-h-[79vh] bg-[url('/images/blocksense-bg.jpg')] dark:bg-[url('/images/dark/blocksense-bg-dark.jpg')] bg-[length:50rem_69rem] bg-center bg-no-repeat">
      <article className="getting-started__content flex flex-col justify-center mx-auto max-w-[55rem] gap-4">
        <h1 className="getting-started__title font-bold tracking-tight text-3xl md:text-4xl lg:text-5xl dark:text-white max-w-screen-xl">
          {gettingStartedConfig.title}
        </h1>
        <p className="getting-started__description font-thin max-w-[38rem] text-gray-900 contrast-125 dark:text-white md:text-lg lg:text-xl">
          {gettingStartedConfig.description}
        </p>
        <div className="flex flex-wrap mt-2">
          <Button
            variant="link"
            href="/docs"
            className="bg-neutral-100 hover:bg-neutral-900 hover:text-white"
            content="Get Started"
          />
        </div>
      </article>
    </section>
  );
};

export default IndexPage;
