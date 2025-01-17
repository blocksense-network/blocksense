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
      'node-operations': {
        items: {
          'reporter-node': '',
        },
      },
      'programming-languages-rnd': {
        title: 'Programming Languages R&D',
        items: {
          'noir-plonky2-backend': '',
        },
      },
    },
  },
};
