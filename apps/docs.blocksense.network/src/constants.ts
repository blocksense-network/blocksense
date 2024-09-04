import * as path from 'path';

export const gitRoot = process.env['GIT_ROOT'] || '';

export const docsBlocksenseNetworkRoot = path.join(
  gitRoot,
  '/apps/docs.blocksense.network/',
);

export const pagesContractRefDocFolder = path.join(
  docsBlocksenseNetworkRoot,
  'pages/docs/contracts/reference-documentation/',
);

export const pagesDataFeedsFolder = path.join(
  docsBlocksenseNetworkRoot,
  'pages/docs/data-feeds/',
);

export const ghContractFolder =
  'https://github.com/blocksense-network/blocksense/blob/main/libs/contracts/';
