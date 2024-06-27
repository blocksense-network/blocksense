import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';

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
    <link
      rel="icon"
      href="/images/blocksense-favicon.png"
      type="image/png"
    ></link>
  ),
};
