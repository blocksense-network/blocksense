import NextHead from 'next/head';
import type { Metadata } from 'next';
import { Layout, Navbar } from '@blocksense/nextra-theme-docs';
import { Footer } from '@/components/common/Footer';
import { getPageMap } from 'nextra/page-map';
import type { FC, ReactNode } from 'react';
import './globals.css';
import { updatePageMapWithContractsRefDoc } from '@/src/pageMap';

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
    template: '%s',
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
  twitter: {
    site: 'https://x.com/blocksense_',
  },
};

const RootLayout: FC<{ children: ReactNode }> = async ({ children }) => {
  const navbar = (
    <Navbar
      logo={
        <div className="bg-[url('/images/blocksense-logo__dark.png')] dark:bg-[url('/images/blocksense-logo__light.png')] h-[29.89px] w-[142px] bg-contain bg-no-repeat" />
      }
      projectLink="https://github.com/blocksense-network/blocksense"
    />
  );
  const footer = <Footer />;
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
        <meta property="og:image" content="/images/blocksense-og.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blocksense Network" />
        <meta
          name="twitter:description"
          content="Blocksense is the ZK rollup for scaling oracle data to infinity. Soon everyone will be able to create secure oracles in minutes."
        />
        <meta name="twitter:image" content="/images/blocksense-og.png" />
      </NextHead>
      <body className="md:px-4 lg:px-30">
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
