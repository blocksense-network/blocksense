import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';

const fonts = [
  '/fonts/fira/FiraCode-Regular.woff2',
  '/fonts/noto-sans/NotoSans-Light.woff2',
  '/fonts/noto-sans/NotoSans-Regular.woff2',
  '/fonts/noto-sans/NotoSans-Thin.woff2',
  '/fonts/noto-sans/NotoSans-Bold.woff2',
  '/fonts/SpaceMono-Bold.woff2',
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
      titleTemplate: 'Blocksense - %s',
    };
  },
  head: (
    <>
      <meta
        name="description"
        content="Blocksense is the ZK rollup for scaling oracle data to infinity. Everyone will be able to create secure oracles in minutes."
      />
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
    </>
  ),
};
