import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';

const fonts = [
  '/fonts/fira/FiraCode-Regular.ttf',
  '/fonts/noto-sans/NotoSans-Black.ttf',
  '/fonts/noto-sans/NotoSans-Bold.ttf',
  '/fonts/noto-sans/NotoSans-BoldItalic.ttf',
  '/fonts/noto-sans/NotoSans-ExtraBold.ttf',
  '/fonts/noto-sans/NotoSans-Italic.ttf',
  '/fonts/noto-sans/NotoSans-Light.ttf',
  '/fonts/noto-sans/NotoSans-LightItalic.ttf',
  '/fonts/noto-sans/NotoSans-Medium.ttf',
  '/fonts/noto-sans/NotoSans-Regular.ttf',
  '/fonts/noto-sans/NotoSans-SemiBold.ttf',
  '/fonts/noto-sans/NotoSans-SemiBoldItalic.ttf',
  '/fonts/noto-sans/NotoSans-Thin.ttf',
  '/fonts/noto-sans/NotoSans-ThinItalic.ttf',
  '/fonts/SpaceMono-Bold.ttf',
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
      <link rel="icon" href="/images/blocksense-favicon.png" type="image/png" />

      {fonts.map(font => (
        <link
          key={font}
          rel="preload"
          href={font}
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      ))}
    </>
  ),
};
