import NextHead from 'next/head';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

import { geist, geistMono } from '../src/geist';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import './globals.css';

export const metadata: Metadata = {
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
    url: 'https://nft.blocksense.network/',
    images: [
      {
        url: '/images/blocksense_og.png',
        width: 1200,
        height: 630,
        alt: 'Blocksense NFT Drop OG Image',
      },
    ],
    type: 'website',
  },
  twitter: {
    images: ['/images/blocksense_og.png'],
    site: 'https://x.com/blocksense_',
  },
  generator: 'Next.js',
  applicationName: 'Blocksense NFT Drop',
  appleWebApp: {
    title: 'Blocksense - NFT Drop',
  },
  title: {
    absolute: '',
    template: '%s - NFT Drop',
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
      <NextHead>
        <meta
          name="description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta
          property="og:description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta property="og:image" content="/images/blocksense_og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:image" content="/images/blocksense_og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blocksense - NFT Drop" />
        <meta
          name="twitter:description"
          content="Explore exclusive NFT drops and mint your NFTs on Blocksense. Join the digital revolution today."
        />
        <meta name="twitter:image" content="/images/blocksense_og.png" />
      </NextHead>
      <body className="nft-drop-layout__body">
        <Navbar />
        <main className="nft-drop-layout__main pt-[3.85rem]">{children}</main>
        <Footer />
      </body>
    </html>
  );
};

export default RootLayout;
