export default {
  index: {
    type: 'page',
    display: 'hidden',
  },
  docs: {
    title: 'Docs',
    items: {
      index: '',
      architecture: {
        items: {
          overview: '',
          'blockchain-integration': '',
        },
      },
      contracts: {
        items: {
          overview: '',
          'integration-guide': {
            items: {
              'using-data-feeds': {
                title: 'Using data feeds',
                items: {
                  'feed-registry': '',
                  'chainlink-proxy': '',
                  'historic-data-feed': '',
                },
              },
            },
          },
          'reference-documentation': {
            items: {
              overview: 'Overview',
              'proxy-call': 'ProxyCall',
              'i-chainlink-feed-registry': 'IChainlinkFeedRegistry',
              'i-chainlink-aggregator': 'IChainlinkAggregator',
              'icl-feed-registry-adapter': 'ICLFeedRegistryAdapter',
              'icl-aggregator-adapter': 'ICLAggregatorAdapter',
              'cl-feed-registry-adapter': 'CLFeedRegistryAdapter',
              'cl-aggregator-adapter': 'CLAggregatorAdapter',
              'upgradeable-proxy': 'UpgradeableProxy',
            },
          },
          'deployed-contracts': 'Deployed Contracts',
        },
      },
      'data-feeds': {
        items: {
          overview: '',
          'creating-data-feeds': '',
        },
      },
    },
  },
};
