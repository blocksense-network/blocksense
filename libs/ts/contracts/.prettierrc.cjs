const defaultConfig = require('../../../.prettierrc.cjs');

const config = {
  ...defaultConfig,
  overrides: [
    {
      files: '*.sol',
      options: {},
    },
  ],
};

module.exports = config;
