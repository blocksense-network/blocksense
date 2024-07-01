import * as fs from 'fs';
import * as path from 'path';
import React from 'react';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { SourceUnit } from '@/sol-contracts-components/SourceUnit';
import { pagesContractRefDocFolder } from './constants';
import { createStaticComponent } from './utils';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

function generateMarkdownContent(sourceUnit: SourceUnitDocItem): string {
  const sourceUnitComponent = React.createElement(SourceUnit, { sourceUnit });
  const staticComponent = createStaticComponent(sourceUnitComponent);

  return staticComponent;
}

function generateSolRefDocFiles() {
  solReflection.forEach((sourceUnit: SourceUnitDocItem) => {
    const content = generateMarkdownContent(sourceUnit);
    const fileName = path
      .basename(sourceUnit.absolutePath)
      .replace('.sol', '.mdx');
    const filePath = path.join(pagesContractRefDocFolder + fileName);

    try {
      fs.writeFileSync(filePath, content);
      console.log(`${fileName} generated`);
    } catch (err) {
      console.error(`Error writing ${fileName}:`, err);
    }
  });
}

generateSolRefDocFiles();
