import { Octokit } from '@octokit/rest';
import type { Schema as S } from 'effect';
import { ParseResult } from 'effect';

import { getOptionalEnvString } from '@blocksense/base-utils/env';

import { FeedsConfig } from '../../data-feeds-config';
import { DeploymentConfigV1 } from '../../evm-contracts-deployment';
import { configTypes, getConfigFilePath } from '../../read-write-config';
import { SequencerConfigV1 } from '../../node-config/types';
import { ChainlinkCompatibilityConfig } from '../../chainlink-compatibility/types';

const OWNER = 'blocksense-network';
const REPO = 'dfcg-artifacts';
const BRANCH = 'main';
const LEGACY_CONFIGS_DIR = 'configs';

const GITHUB_TOKEN = getOptionalEnvString(
  'DFCG_ARTIFACTS_ACCESS_TOKEN',
  'missing',
);

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

export type Artifacts = {
  sequencerDeploymentConfigV1: SequencerConfigV1;
  feedsConfigV1: FeedsConfig;
  evmContractsDeploymentV1: Partial<DeploymentConfigV1>;
  chainlinkDeploymentV1: ChainlinkCompatibilityConfig;
};

export async function downloadAndDecodeFile<A, I>(
  filePath: string,
  schema: S.Schema<A, I, never>,
) {
  const { data: fileData } = await octokit.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: filePath,
    ref: BRANCH,
  });

  if (!('download_url' in fileData)) {
    throw new Error(`Unexpected response structure for ${filePath}`);
  }

  console.info(`Start downloading: ${filePath}`);
  const response = await fetch(fileData.download_url!);
  console.info(`Downloaded       : ${filePath}`);

  const fileContent = await response.text();

  return ParseResult.decodeUnknownSync(schema)(JSON.parse(fileContent));
}

export async function fetchRepoFiles(): Promise<Artifacts> {
  const [sequencerData, feedsData, evmContractsData, chainlinkData] =
    await Promise.all([
      downloadAndDecodeFile(
        getConfigFilePath('sequencer_config_v1', LEGACY_CONFIGS_DIR),
        configTypes['sequencer_config_v1'],
      ),
      downloadAndDecodeFile(
        getConfigFilePath('feeds_config_v1', LEGACY_CONFIGS_DIR),
        configTypes['feeds_config_v1'],
      ),
      downloadAndDecodeFile(
        getConfigFilePath('evm_contracts_deployment_v1', LEGACY_CONFIGS_DIR),
        configTypes['evm_contracts_deployment_v1'],
      ),
      downloadAndDecodeFile(
        getConfigFilePath('chainlink_compatibility_v1', LEGACY_CONFIGS_DIR),
        configTypes['chainlink_compatibility_v1'],
      ),
    ]);

  return {
    sequencerDeploymentConfigV1: {
      providers: sequencerData.providers,
    },
    feedsConfigV1: {
      feeds: feedsData.feeds,
    },
    evmContractsDeploymentV1: evmContractsData,
    chainlinkDeploymentV1: chainlinkData,
  };
}

export async function isTokenValid(): Promise<boolean> {
  if (GITHUB_TOKEN === 'missing') {
    return false;
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) {
      return false;
    }
    throw error;
  }
}
