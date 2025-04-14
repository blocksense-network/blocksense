import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';
import { CTA } from 'components/CTA';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage = () => {
  return (
    <>
      <Hero />
      <Form />
      <CTA />
    </>
  );
};

export default NFTDropPage;
