import * as path from 'path';

import { pagesContractRefDocFolder } from './constants';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { selectDirectory } from '@blocksense/base-utils';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

function stringifyObject(obj: any): string {
  return JSON.stringify(obj)
    .replace(/\\n/g, '\\\\n')
    .replace(/\\'/g, "\\\\'")
    .replace(/\\"/g, '\\\\"')
    .replace(/\\&/g, '\\\\&')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
    .replace(/\\b/g, '\\\\b')
    .replace(/\\f/g, '\\\\f');
}

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const content = `
import { SourceUnit } from '@/sol-contracts-components/SourceUnit';

<SourceUnit sourceUnitJsonString={'${stringifyObject(sourceUnit)}'} />
`;

  return content;
}

function generateSolRefDocFiles(): Promise<string[]> {
  const mdxFiles = solReflection.map(sourceUnit => ({
    name: path.parse(sourceUnit.absolutePath).name,
    content: generateMarkdownContent(sourceUnit),
  }));

  const metaJSON = mdxFiles.reduce(
    (obj, { name }) => ({ [name]: name, ...obj }),
    {},
  );

  const { write, writeJSON } = selectDirectory(pagesContractRefDocFolder);

  return Promise.all([
    ...mdxFiles.map(args => write({ ext: '.mdx', ...args })),
    writeJSON({ base: '_meta.json', content: metaJSON }),
  ]);
}

generateSolRefDocFiles()
  .then(() => console.log('Files generated!'))
  .catch(err => {
    console.log(err);
  });
