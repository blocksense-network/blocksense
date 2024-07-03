import * as fs from 'fs';
import * as path from 'path';

import { pagesContractRefDocFolder } from './constants';

export function writeMetaJsonFile(metaJSON: Record<string, string>) {
  const metaJSONFilePath = path.join(pagesContractRefDocFolder, '_meta.json');

  try {
    fs.writeFileSync(metaJSONFilePath, JSON.stringify(metaJSON, null, 2));
    console.log('_meta.json generated');
  } catch (err) {
    console.error('Error writing _meta.json:', err);
  }
}
