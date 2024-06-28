import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import { SourceUnit } from '@/components/smart-contracts/source-unit/SourceUnit';
import SOURCE_UNITS_JSON from '@blocksense/contracts/docs/fine';

const generateMarkdownContent = (sourceUnit: SourceUnitDocItem) => {
  const sourceUnitComponent = React.createElement(SourceUnit, { sourceUnit });
  let componentString =
    ReactDOMServer.renderToStaticMarkup(sourceUnitComponent);

  componentString = componentString.replace(/class="/g, 'className="');

  return componentString;
};

const getFileName = (absolutePath: string) => {
  const absolutePathParts = absolutePath.split('/');
  const fileNameWithExtension = `${absolutePathParts[absolutePathParts.length - 1]}.mdx`;
  const fileName = fileNameWithExtension.split('.')[0] + '.mdx';

  return fileName;
};

(SOURCE_UNITS_JSON as SourceUnitDocItem[]).forEach(
  (sourceUnit: SourceUnitDocItem) => {
    const content = generateMarkdownContent(sourceUnit);
    const fileName = getFileName(sourceUnit.absolutePath);
    const filePath = path.join(
      __dirname,
      `../pages/docs/contracts/${fileName}`,
    );

    try {
      fs.writeFileSync(filePath, content);
      console.log(`${fileName} generated`);
    } catch (err) {
      console.error(`Error writing ${fileName}:`, err);
    }
  },
);
