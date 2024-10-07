import * as path from 'path';

export const gitRoot = process.env['GIT_ROOT'] || '';

export const docsBlocksenseNetworkRoot = path.join(
  gitRoot,
  '/apps/docs.blocksense.network/',
);

export const pagesContractsFolder = path.join(
  docsBlocksenseNetworkRoot,
  'pages/docs/contracts/',
);

export const pagesContractRefDocFolder = path.join(
  pagesContractsFolder,
  'reference-documentation/',
);

export const pagesDataFeedsFolder = path.join(
  docsBlocksenseNetworkRoot,
  'pages/docs/data-feeds/',
);

export const ghContractFolder =
  'https://github.com/blocksense-network/blocksense/blob/main/libs/ts/contracts/';

export const dataFeedUrl = '/docs/data-feeds/feed/';
