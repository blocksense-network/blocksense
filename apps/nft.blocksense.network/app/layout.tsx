import NextHead from 'next/head';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { geist, geistMono } from '../src/geist';
import { Footer } from '../components/Footer';
import './globals.css';

export const metadata: Metadata = {
  description:
    'Explore exclusive NFT drops and be part of the next digital revolution. Mint your NFT now on the Blocksense platform.',
  metadataBase: new URL('https://blocksense.network/'),
  keywords: [
    'NFT Drop',
    'Blocksense',
    'Mint NFT',
    'Digital Revolution',
    'Exclusive NFT',
    'Blockchain',
    'Smart contracts',
    'Decentralized',
    'NFT Collection',
  ],
  generator: 'Next.js',
  applicationName: 'Blocksense NFT Drop',
  appleWebApp: {
    title: 'NFT Drop - Blocksense',
  },
  title: {
    absolute: '',
    template: '%s - NFT Drop',
  },
  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: dark)',
        url: '/images/nft-favicon.png',
        type: 'image/png',
      },
      {
        media: '(prefers-color-scheme: light)',
        url: '/images/nft-favicon.png',
        type: 'image/png',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#000',
  },
  twitter: {
    site: 'https://twitter.com/blocksense_',
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
          content="Explore exclusive NFT drops and be part of the next digital revolution. Mint your NFT now on the Blocksense platform."
        />
        <meta
          property="og:description"
          content="Join the latest NFT drop on Blocksense! Discover, mint, and own exclusive digital art."
        />
        <meta property="og:image" content="/images/nft-og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NFT Drop - Blocksense" />
        <meta
          name="twitter:description"
          content="Explore exclusive NFT drops and mint your NFTs on Blocksense. Join the digital revolution today."
        />
        <meta name="twitter:image" content="/images/nft-og.png" />
        <link rel="icon" href="/images/nft-favicon.png" type="image/png" />
      </NextHead>
      <body className="nft-drop-layout__body md:px-4 lg:px-30  dark:text-neutral-300">
        {/* ToDo: Replace header below with Header component */}
        <header className="nft-drop-layout__header">
          <nav className="nft-drop-layout__navbar">
            <a
              href="https://github.com/blocksense-network/blocksense"
              className="nft-drop-layout__project-link"
            >
              Blocksense monorepo
            </a>
          </nav>
        </header>
        <main className="nft-drop-layout__main">{children}</main>
        <Footer />
      </body>
    </html>
  );
};

export default RootLayout;
