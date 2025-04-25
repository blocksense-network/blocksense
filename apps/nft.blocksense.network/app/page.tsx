import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';
import { CTA } from 'components/CTA';
import { About } from 'components/About';
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
    </>
  );
};

export default NFTDropPage;
