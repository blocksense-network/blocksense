import { mkdir } from 'fs/promises';
import { parse as parsePath } from 'path';

import { selectDirectory } from '@blocksense/base-utils/fs';

import { chainlinkFeedsDir } from '../src/paths';

const commitHash = '05da0466ce4ff5e2ea9c73147bf0b9aafa3af834';
const feedsJsonRegistryUrl = `https://raw.githubusercontent.com/smartcontractkit/documentation/${commitHash}/src/features/data/chains.ts`;
const baseUrl = 'https://reference-data-directory.vercel.app';
const pattern = new RegExp(`${baseUrl}/feeds-([^"]+)`, 'g');

await mkdir(chainlinkFeedsDir, { recursive: true });
const { write } = selectDirectory(chainlinkFeedsDir);

async function download(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch '${url}'. Error: ${resp.statusText}`);
  }
  return resp.text();
}

const sourceFile = await download(feedsJsonRegistryUrl);

for (const match of sourceFile.matchAll(pattern)) {
  const { name } = parsePath(match[0]);
  const content = await download(match[0]);
  const filePath = await write({ content, name, ext: 'json' });
  console.log(`Saved '${filePath}'`);
}
