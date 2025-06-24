import { Octokit } from '@octokit/rest';
import type { Schema as S } from 'effect';
import { ParseResult } from 'effect';
import type { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import type { DeploymentConfigV1 } from '@blocksense/config-types';
import { configFiles } from '@blocksense/config-types';
import { getEnvString } from '@blocksense/base-utils/env';
import type { SequencerDeploymentConfig } from 'libs/ts/config-types/src/node-config';

const OWNER = 'blocksense-network';
const REPO = 'dfcg-artifacts';
const BRANCH = 'main';
const CONFIGS_DIR = 'configs';

const GITHUB_TOKEN = getEnvString('DFCG_ARTIFACTS_ACCESS_TOKEN');

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

export type Artifacts = {
  sequencerDeploymentConfigV1: SequencerDeploymentConfig;
  feedsConfigV1: FeedsConfig;
  evmContractsDeploymentV1: Partial<DeploymentConfigV1>;
};

async function downloadAndDecodeFile<A, I>(
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
  const { evm_contracts_deployment_v1, feeds_config_v1, sequencer_config_v1 } =
    configFiles(CONFIGS_DIR);

  const [sequencerData, feedsData, evmContractsData] = await Promise.all([
    downloadAndDecodeFile(sequencer_config_v1.path, sequencer_config_v1.schema),
    downloadAndDecodeFile(feeds_config_v1.path, feeds_config_v1.schema),
    downloadAndDecodeFile(
      evm_contracts_deployment_v1.path,
      evm_contracts_deployment_v1.schema,
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
  };
}
