import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ThirdwebProvider } from 'thirdweb/react';

import { Navbar } from '../components/Navbar';
import { ConsentManager } from '../components/ConsentManager';
import { Footer } from '../components/Footer';
import { geist, geistMono } from '../src/geist';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s - NFT Drop',
    default: 'Blocksense NFT Drop',
  },
  description:
    'Explore exclusive NFT drops and be part of the next digital revolution. Mint your NFT now on the Blocksense platform.',
  metadataBase: new URL('https://nft.blocksense.network/'),
  keywords: [
    'NFT Drop',
    'Mint NFT',
    'NFT Collection',
    'Blockchain',
    'Smart Contracts',
    'Decentralized',
    'Crypto Art',
    'Web3',
    'Digital Ownership',
    'NFT Marketplace',
    'Exclusive NFT',
    'Tokenized Assets',
    'Digital Revolution',
    'Ethereum',
    'Metaverse',
  ],
  openGraph: {
    title: 'Blocksense NFT Drop',
    description:
      'Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes.',
    url: 'https://nft.blocksense.network/',
    type: 'website',
    images: [
      {
        url: '/images/blocksense_og.png',
        width: 1200,
        height: 630,
        alt: 'Blocksense NFT Drop OG Image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: 'https://x.com/blocksense_',
    title: 'Blocksense - NFT Drop',
    description:
      'Explore exclusive NFT drops and mint your NFTs on Blocksense. Join the digital revolution today.',
    images: ['/images/blocksense_og.png'],
  },
  applicationName: 'Blocksense NFT Drop',
  generator: 'Next.js',
  appleWebApp: {
    title: 'Blocksense - NFT Drop',
  },
  icons: {
    icon: [
      {
        rel: 'icon',
        url: '/icons/blocksense-favicon-dark.png',
        type: 'image/png',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#000',
  },
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="nft-drop-layout__body">
        <ThirdwebProvider>
          <Navbar />
          <main className="nft-drop-layout__main pt-[3.85rem]">{children}</main>
          <Footer />
          <ConsentManager />
        </ThirdwebProvider>
      </body>
    </html>
  );
};

export default RootLayout;
