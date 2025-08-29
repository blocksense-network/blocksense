module.exports = {
  skipFiles: ['test/'],
  mocha: {
    grep: '@skip-coverage',
    invert: true,
  },
};
