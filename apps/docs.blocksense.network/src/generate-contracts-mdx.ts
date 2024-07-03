import * as path from 'path';
import React from 'react';

import { writeGeneratedMdx } from './write-generated-mdx';
import { writeMetaJsonFile } from './write-meta-json-file';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { SourceUnit } from '@/sol-contracts-components/SourceUnit';
import { createStaticComponent } from './utils';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

type MetaJSON = Record<string, string>;

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const sourceUnitComponent = React.createElement(SourceUnit, { sourceUnit });
  const staticComponent = createStaticComponent(sourceUnitComponent);

  return staticComponent;
}

function generateSolRefDocFiles() {
  const metaJSON: MetaJSON = {};

  solReflection.forEach((sourceUnit: SourceUnitDocItem) => {
    const content = generateMarkdownContent(sourceUnit);
    const fileName = path
      .basename(sourceUnit.absolutePath)
      .replace('.sol', '.mdx');

    writeGeneratedMdx(fileName, content);

    const fileNameWithoutExtension = path.basename(fileName, '.mdx');
    metaJSON[fileNameWithoutExtension] = fileNameWithoutExtension;
  });

  writeMetaJsonFile(metaJSON);
}

generateSolRefDocFiles();
