import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';
import { Form } from 'components/Form';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage = () => {
  return (
    <>
      <Hero />
      <Form />
    </>
  );
};

export default NFTDropPage;
