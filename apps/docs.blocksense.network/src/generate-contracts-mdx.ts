import * as path from 'path';

import { pagesContractRefDocFolder } from './constants';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { selectDirectory } from '@blocksense/base-utils/fs';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

function stringifyObject(obj: any): string {
  return `'${JSON.stringify(obj)
    .replace(/\\n/g, '\\\\n')
    .replace(/\\'/g, "\\\\'")
    .replace(/\\"/g, '\\\\"')
    .replace(/\\&/g, '\\\\&')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
    .replace(/\\b/g, '\\\\b')
    .replace(/\\f/g, '\\\\f')}'`;
}

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const sourceUnitJsonString = stringifyObject(sourceUnit);

  const content = `
import { SourceUnit } from '@/sol-contracts-components/SourceUnit';

<SourceUnit sourceUnitJsonString={${sourceUnitJsonString}} />
`;

  return content;
}

function generateLinkContent(name: string): string {
  const content = `<ContractAnchorLink label='${name}'></ContractAnchorLink>\n`;

  return content;
}

function generateOverviewContent(contractsMetaJSON: {
  [key: string]: string;
}): string {
  let overviewContent = `import { ContractAnchorLink } from '@blocksense/docs.blocksense.network/components/sol-contracts/ContractAnchorLink';\n
  # Introduction\n
  Explore the range of smart contracts available within the Blocksense protocol. This overview covers contracts for interacting with data feeds, historical data feed storage, proxy contracts, and interfaces for integrating with data aggregation services.\n
  <br/>`;
  overviewContent += `<ul className="overview__list nx-mt-6 nx-list-none first:nx-mt-0 ltr:nx-ml-0 rtl:nx-mr-6">`;
  Object.keys(contractsMetaJSON).map(name => {
    overviewContent += generateLinkContent(name);
  });
  overviewContent += `</ul>`;
  return overviewContent;
}

function generateSolRefDocFiles(): Promise<string[]> {
  const mdxFiles = solReflection.map(sourceUnit => ({
    name: path.parse(sourceUnit.absolutePath).name,
    content: generateMarkdownContent(sourceUnit),
  }));

  let metaJSON = mdxFiles.reduce(
    (obj, { name }) => ({ [name]: name, ...obj }),
    {},
  );

  const overviewContent = generateOverviewContent(metaJSON);

  mdxFiles.push({ name: 'index', content: overviewContent });
  metaJSON = { index: 'Overview', ...metaJSON };

  const { write, writeJSON } = selectDirectory(pagesContractRefDocFolder);

  return Promise.all([
    ...mdxFiles.map(args => write({ ext: '.mdx', ...args })),
    writeJSON({
      base: '_meta.json',
      content: metaJSON,
    }),
  ]);
}

generateSolRefDocFiles()
  .then(() => console.log('Files generated!'))
  .catch(err => {
    console.log(err);
  });
