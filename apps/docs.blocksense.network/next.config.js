const withNextra = require('nextra')({
  theme: '@blocksense/docs-theme',
  themeConfig: './theme.config.tsx',
});

module.exports = withNextra();
