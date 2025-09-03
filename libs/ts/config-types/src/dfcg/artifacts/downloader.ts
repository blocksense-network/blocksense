import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import type { Schema as S } from 'effect';

import { getOptionalEnvString } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';
import { mapValuePromises } from '@blocksense/base-utils/array-iter';

import { FeedsConfig } from '../../data-feeds-config';
import { DeploymentConfigV1 } from '../../evm-contracts-deployment';
import {
  ConfigFileName,
  configTypes,
  getConfigFilePath,
} from '../../read-write-config';
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

  return await fetchAndDecodeJSON(schema, fileData.download_url!);
}

function fetchConfigFromDfcgRepo<Name extends ConfigFileName>(
  configFileName: Name,
) {
  return downloadAndDecodeFile(
    getConfigFilePath(configFileName, LEGACY_CONFIGS_DIR),
    configTypes[configFileName] as S.Schema<any, any, never>,
  );
}

export async function fetchRepoFiles(): Promise<Artifacts> {
  const legacyConfigFiles = {
    sequencerDeploymentConfigV1: 'sequencer_config_v1',
    feedsConfigV1: 'feeds_config_v1',
    evmContractsDeploymentV1: 'evm_contracts_deployment_v1',
    chainlinkDeploymentV1: 'chainlink_compatibility_v1',
  } satisfies Record<string, ConfigFileName>;

  return mapValuePromises(legacyConfigFiles, (key, cfgFileName) =>
    fetchConfigFromDfcgRepo(cfgFileName),
  );
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
