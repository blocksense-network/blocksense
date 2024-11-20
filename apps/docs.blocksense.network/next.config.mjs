// const withNextra = require('nextra')({
//   theme: '@blocksense/docs-theme',
//   themeConfig: './theme.config.tsx',
// });

// module.exports = withNextra();

// import nextra from 'nextra';

// const withNextra = nextra({
//   theme: '@blocksense/docs-theme',
//   themeConfig: './theme.config.tsx',
// });

// export default withNextra({});

import nextra from 'nextra';

const withNextra = nextra({
  theme: '@blocksense/docs-theme',
  themeConfig: './theme.config.tsx',
  latex: true,
  search: {
    codeblocks: false,
  },
});

export default withNextra({
  reactStrictMode: true,
});
