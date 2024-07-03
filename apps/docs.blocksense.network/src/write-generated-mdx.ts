import * as fs from 'fs';
import path from 'path';

import { pagesContractRefDocFolder } from './constants';

export function writeGeneratedMdx(fileName: string, content: string) {
  try {
    const filePath = path.join(pagesContractRefDocFolder + fileName);

    fs.writeFileSync(filePath, content);
    console.log(`${fileName} generated`);
  } catch (err) {
    console.error(`Error writing ${fileName}:`, err);
  }
}
