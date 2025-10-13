import { About } from 'components/About';
import { CTA } from 'components/CTA';
import { Form } from 'components/Form';
import { Hero } from 'components/Hero';
import type { Metadata } from 'next';

import { nftDropConfig } from '../config';

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
