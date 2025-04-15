import type { Metadata } from 'next';

import { nftDropConfig } from '../config';
import { Hero } from 'components/Hero';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage = () => {
  return <Hero />;
};

export default NFTDropPage;
