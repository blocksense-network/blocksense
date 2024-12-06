import NextHead from 'next/head';
import type { Metadata, Viewport } from 'next';
import { Footer, Layout, Link, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import type { FC, ReactNode } from 'react';
import './globals.css';

export const viewport: Viewport = Head.viewport;

export const metadata: Metadata = {
  description:
    'Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes.',
  metadataBase: new URL('https://blocksense.network/'),
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
    template: 'Blocksense | %s ',
  },
  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: dark)',
        url: '/images/blocksense-favicon.png',
        type: 'image/png',
      },
      {
        media: '(prefers-color-scheme: light)',
        url: '/images/blocksense-favicon.png',
        type: 'image/png',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#fff',
  },
  twitter: {
    site: 'https://x.com/blocksense_',
  },
};

const RootLayout = async ({ children }) => {
  const navbar = (
    <Navbar
      logo={<span>blocksense</span>}
      projectLink="https://github.com/blocksense-network/blocksense"
    />
  );
  const footer = (
    <Footer className="flex-col items-center md:items-start">
      <p className="mt-6 text-xs">© {new Date().getFullYear()} Blocksense</p>
    </Footer>
  );
  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <NextHead>
        <meta
          name="description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta
          property="og:description"
          content="The ZK rollup for verifiable data and compute services. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta property="og:image" content="/images/blocksense-og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blocksense Network" />
        <meta
          name="twitter:description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta name="twitter:image" content="/images/blocksense-og.png" />
        <link
          rel="icon"
          href="/images/blocksense-favicon.png"
          type="image/png"
        />
      </NextHead>
      <body>
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          editLink="Edit this page on GitHub"
          sidebar={{ defaultMenuCollapseLevel: 3 }}
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
};

export default RootLayout;
