import * as path from 'path';

import { pagesContractRefDocFolder } from './constants';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { selectDirectory } from '@blocksense/base-utils/fs';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
import { stringifyObject } from './utils';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const sourceUnitJsonString = stringifyObject(sourceUnit);

  const content = `
import { SourceUnit } from '@/sol-contracts-components/SourceUnit';

<SourceUnit sourceUnitJsonString={${sourceUnitJsonString}} />
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
