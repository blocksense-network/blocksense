import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';

const fonts = [
  '/fonts/fira/FiraCode-Regular.woff2',
  '/fonts/geist/Geist-Regular.woff2',
  '/fonts/geist/GeistMono-Regular.woff2',
];

export default {
  logo: Header,
  project: {
    link: 'https://github.com/blocksense-network/blocksense',
  },
  docsRepositoryBase: 'https://github.com/blocksense-network/blocksense',
  footer: {
    component: Footer,
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s',
    };
  },
  head: (
    <>
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
      <link rel="icon" href="/images/blocksense-favicon.png" type="image/png" />
      {fonts.map(font => (
        <link
          key={font}
          rel="preload"
          href={font}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      <script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-7S6ERW2H50"
      ></script>
      <script>
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-7S6ERW2H50');`}
      </script>
    </>
  ),
};
