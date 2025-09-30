import { configDir, rootDir } from '@blocksense/base-utils/env';

export { rootDir, configDir };

export const workspaceDir = `${rootDir}/apps/data-feeds-config-generator`;
export const artifactsDir = `${workspaceDir}/artifacts`;
export const chainlinkFeedsDir = `${artifactsDir}/chainlink_feeds`;
export const dataProvidersDir = `${artifactsDir}/data-providers`;
