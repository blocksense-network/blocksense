import { join } from 'path';
import { getEnvString } from './functions';

/**
 * The root directory of the Git repository.
 */
export const rootDir = getEnvString('GIT_ROOT');

/**
 * The root configuration directory.
 */
export const configDir = join(rootDir, 'config');

/**
 * The root directory for the Process Compose logs.
 */
export const processComposeLogsDir = join(rootDir, 'logs/blocksense');

export const processComposeLogsFiles = {
  ['aggregate-consensus-reader']: join(
    processComposeLogsDir,
    'aggregate-consensus-reader.log.log',
  ),
  ['anvil-ethereum-sepolia']: join(
    processComposeLogsDir,
    'anvil-ethereum-sepolia.log.log',
  ),
  ['anvil-ink-sepolia']: join(processComposeLogsDir, 'anvil-ink-sepolia.log'),
  ['blockchain-reader']: join(processComposeLogsDir, 'blockchain-reader.log'),
  ['reporter-a']: join(processComposeLogsDir, 'reporter-a.log'),
  ['sequencer']: join(processComposeLogsDir, 'sequencer.log'),
};
