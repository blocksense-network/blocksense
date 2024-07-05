import * as path from 'path';
import React from 'react';

import { pagesContractRefDocFolder } from './constants';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { SourceUnit } from '@/sol-contracts-components/SourceUnit';
import { createFsIOForDir } from './fs-IO-for-dir';
import { createStaticComponent } from './utils';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const sourceUnitComponent = React.createElement(SourceUnit, { sourceUnit });
  const staticComponent = createStaticComponent(sourceUnitComponent);

  return staticComponent;
}

function generateSolRefDocFiles(): Promise<void[]> {
  const mdxFiles = solReflection.map(sourceUnit => ({
    name: path.parse(sourceUnit.absolutePath).name,
    content: generateMarkdownContent(sourceUnit),
  }));

  const metaJSON = mdxFiles.reduce(
    (obj, { name }) => ({ [name]: name, ...obj }),
    {},
  );

  const { write, writeJSON } = createFsIOForDir(pagesContractRefDocFolder);

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
