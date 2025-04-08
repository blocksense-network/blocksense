import type { Metadata } from 'next';
import type { FC } from 'react';

import { nftDropConfig } from '../config';

export const metadata: Metadata = {
  title: nftDropConfig.title,
};

const NFTDropPage: FC = () => {
  return <p>NFT Drop Page layout</p>;
};

export default NFTDropPage;
