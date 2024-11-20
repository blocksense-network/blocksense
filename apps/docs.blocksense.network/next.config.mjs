// const withNextra = require('nextra')({
//   theme: '@blocksense/docs-theme',
//   themeConfig: './theme.config.tsx',
// });

// module.exports = withNextra();

import nextra from 'nextra';
const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  latex: true,
  search: {
    codeblocks: false,
  },
});
export default withNextra({
  reactStrictMode: true,
});
