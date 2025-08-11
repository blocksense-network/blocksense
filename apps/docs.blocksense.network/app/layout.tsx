import NextHead from 'next/head';
import type { Metadata } from 'next';
import { getPageMap } from 'nextra/page-map';
import type { FC, ReactNode } from 'react';
import './globals.css';
import { updatePageMapWithContractsRefDoc } from '@/src/pageMap';
import { NextraTheme } from './_components/nextra-theme';

export const metadata: Metadata = {
  description:
    'Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes.',
  metadataBase: new URL('https://docs.blocksense.network/'),
  keywords: [
    'Blocksense',
    'ZK rollup',
    'Oracle data',
    'Blockchain',
    'Smart contracts',
    'Data feeds',
    'Decentralized',
    'Secure oracles',
  ],
  generator: 'Next.js',
  applicationName: 'Blocksense',
  appleWebApp: {
    title: 'Blocksense',
  },
  title: {
    absolute: '',
    template: '%s',
  },
  openGraph: {
    title: 'Blocksense Network',
    url: 'https://docs.blocksense.network',
    images: [
      {
        url: '/images/blocksense_og.png',
        width: 1200,
        height: 630,
        alt: 'Blocksense OG Image',
      },
    ],
    type: 'website',
  },
  twitter: {
    images: ['/images/blocksense_og.png'],
    site: 'https://x.com/blocksense_',
  },
  icons: {
    icon: [
      {
        rel: 'icon',
        media: '(prefers-color-scheme: dark)',
        url: '/images/blocksense-favicon-dark.png',
        type: 'image/png',
      },
      {
        rel: 'icon',
        media: '(prefers-color-scheme: light)',
        url: '/images/blocksense-favicon-light.png',
        type: 'image/png',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#fff',
  },
};

const RootLayout: FC<{ children: ReactNode }> = async ({ children }) => {
  const pageMap = await getPageMap();
  updatePageMapWithContractsRefDoc(pageMap);

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <NextHead>
        <meta
          name="description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta
          property="og:description"
          content="The zk rollup for programmable oracles."
        />
        <meta property="og:image" content="/images/blocksense_og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blocksense Network" />
        <meta
          name="twitter:description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta name="twitter:image" content="/images/blocksense_og.png" />
      </NextHead>
      <body style={{ margin: 0 }}>
        <NextraTheme pageMap={pageMap}>{children}</NextraTheme>
      </body>
    </html>
  );
};

export default RootLayout;
