import { Octokit } from '@octokit/rest';
import { Schema, ParseResult } from 'effect';

import { getEnvString } from '@blocksense/base-utils/env';
import { ProviderData } from '../generation/initial/data-providers';
import {
  ChainLinkFeedInfo,
  ChainLinkFeedInfoSchema,
} from './fetchers/chainlink/types';
import {
  CMCMarketCapDataRes,
  CMCMarketCapDataResSchema,
} from './fetchers/aggregators/cmc';

const OWNER = 'blocksense-network';
const REPO = 'dfcg-artifacts';
const BRANCH = 'main';

const CMC_MARKET_CAP_DATA_ARTIFACT = 'cmc_market_cap_data.json';
const PROVIDERS_DATA_ARTIFACT = 'providers_data.json';
const CHAINLINK_FEEDS_DATA_DIR = 'chainlink_feeds';

const GITHUB_TOKEN = getEnvString('DFCG_ARTIFACTS_ACCESS_TOKEN');

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

export type CLArtifacts = {
  base: string;
  content: ChainLinkFeedInfo;
};

export type Artifacts = {
  cmcMarketCap: CMCMarketCapDataRes;
  exchangeAssets: ProviderData[];
  clArtifacts: CLArtifacts[];
};

async function downloadAndDecodeFile<A, I>(
  filePath: string,
  schema: Schema.Schema<A, I, never> | null,
) {
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      ref: BRANCH,
    });

    if (!('download_url' in fileData)) {
      throw new Error('Unexpected response structure');
    }

    const fileResponse = await fetch(fileData.download_url!);
    console.info(`Downloaded: ${filePath}`);

    const fileContent = await fileResponse.text();
    const fileContentAsJson = JSON.parse(fileContent);

    if (schema) {
      return ParseResult.decodeUnknownSync(schema)(fileContentAsJson);
    }
    return fileContentAsJson;
  } catch (error) {
    console.error(`Error downloading ${filePath}:`, error);
  }
}

export async function fetchRepoFiles(
  dirPath: string = '',
  artifacts: Artifacts = {
    cmcMarketCap: [],
    exchangeAssets: [],
    clArtifacts: [],
  },
) {
  try {
    const { data: files } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: dirPath,
      ref: BRANCH,
    });

    if (!Array.isArray(files)) {
      throw new Error('No files found');
    }

    for (const file of files) {
      if (file.type === 'file') {
        if (file.name === CMC_MARKET_CAP_DATA_ARTIFACT) {
          artifacts.cmcMarketCap = await downloadAndDecodeFile(
            file.path,
            CMCMarketCapDataResSchema,
          );
        } else if (file.name === PROVIDERS_DATA_ARTIFACT) {
          artifacts.exchangeAssets = await downloadAndDecodeFile(
            file.path,
            null,
          );
        } else {
          const content = await downloadAndDecodeFile(
            file.path,
            Schema.Array(ChainLinkFeedInfoSchema),
          );
          artifacts.clArtifacts.push({
            base: file.name,
            content,
          });
        }
      } else if (file.type === 'dir') {
        if (file.path === CHAINLINK_FEEDS_DATA_DIR) {
          console.info(`Fetching files in ${file.path}`);
          await fetchRepoFiles(file.path, artifacts); // Recursively fetch subdirectories
        } else {
          console.warn(`Unknown directory: ${file.path}`);
        }
      }
    }

    return artifacts;
  } catch (error) {
    console.error(`Error fetching files in ${dirPath}:`, error);
    return null;
  }
}
