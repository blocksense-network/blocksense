import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { CTA } from 'components/CTA';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage = () => {
  return (
    <>
      <Hero />
      <CTA />
    </>
  );
};

export default NFTDropPage;
