module.exports = {
  skipFiles: ['Decoder.sol', 'test/'],
  mocha: {
    grep: '@skip-coverage',
    invert: true,
  },
};
