import type { Metadata } from 'next';
import type { FC } from 'react';

import { nftDropConfig } from '../config';
import { Button } from '@blocksense/ui/Button';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage: FC = () => {
  return (
    <section className="nft-drop flex items-center justify-center min-h-screen bg-[url('/images/nft-bg.jpg')] dark:bg-[url('/images/dark/nft-bg-dark.jpg')] bg-cover bg-center">
      <article className="nft-drop__content flex flex-col items-center text-center max-w-lg gap-6 p-6 bg-white/90 dark:bg-black/90 rounded-xl shadow-lg">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          {nftDropConfig.title}
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {nftDropConfig.description}
        </p>
        <Button
          variant="link"
          href={nftDropConfig.buttonLink}
          className="bg-neutral-100 hover:bg-neutral-900 hover:text-white px-6 py-2 rounded-md"
          content={nftDropConfig.buttonText}
        />
      </article>
    </section>
  );
};

export default NFTDropPage;
