import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';
import { CTA } from 'components/CTA';
import { About } from 'components/About';
import { ProductFeatures } from 'components/ProductFeatures';
export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage = () => {
  return (
    <>
      <Hero />
      <Form />
      <About />
      <CTA />

      {/* Implement scrolling animation using Motion */}
      <ProductFeatures />
    </>
  );
};

export default NFTDropPage;
