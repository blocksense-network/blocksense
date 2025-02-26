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
                  'cl-feed-registry-adapter': '',
                  'cl-aggregator-adapter': '',
                  'aggregated-data-feed-store': '',
                },
              },
            },
          },
          'reference-documentation': 'Reference Documentation',
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
