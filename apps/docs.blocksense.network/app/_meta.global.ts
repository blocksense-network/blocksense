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
              Overview: '',
              ProxyCall: '',
              IChainlinkFeedRegistry: '',
              IChainlinkAggregator: '',
              IFeedRegistry: '',
              IAggregator: '',
              FeedRegistry: '',
              ChainlinkProxy: '',
              UpgradeableProxy: '',
              HistoricDataFeedStoreV2: '',
              HistoricDataFeedStoreV1: '',
              DataFeedStoreV3: '',
              DataFeedStoreV2: '',
              DataFeedStoreV1: '',
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
