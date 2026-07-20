import type { Schema as S } from 'effect';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';

import { mapValuePromises } from '@blocksense/base-utils/array-iter';
import { getOptionalEnvString } from '@blocksense/base-utils/env';
import { fetchAndDecodeJSON } from '@blocksense/base-utils/http';

import type { ChainlinkCompatibilityConfig } from '../../chainlink-compatibility/types';
import type { FeedsConfig } from '../../data-feeds-config';
import type { DeploymentConfigV1 } from '../../evm-contracts-deployment';
import type { SequencerConfigV1 } from '../../node-config/types';
import type { ConfigFileName } from '../../read-write-config';
import { configTypes, getConfigFilePath } from '../../read-write-config';

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
    // Probe access to the actual artifacts repo rather than `/user`.
    // A GitHub App installation token (minted by the ci-token-provider
    // App) is not a user, so `users.getAuthenticated()` returns 403
    // ("Resource not accessible by integration") even when the token can
    // read the repo. `repos.get` only needs metadata:read and works for
    // both App installation tokens and classic PATs — and it checks the
    // thing we actually care about: can we reach dfcg-artifacts.
    await octokit.rest.repos.get({ owner: OWNER, repo: REPO });
    return true;
  } catch (error) {
    // Octokit can surface a RequestError from a differently-resolved copy of
    // `@octokit/request-error`, so `instanceof` is unreliable here. Fall back
    // to the numeric `status` carried on the error. A missing/expired/
    // unauthorized token (401/403/404) means we can't read the repo, so the
    // callers skip rather than crash.
    const status =
      error instanceof RequestError
        ? error.status
        : (error as { status?: number } | null)?.status;
    if (status === 401 || status === 403 || status === 404) {
      return false;
    }
    throw error;
  }
}
