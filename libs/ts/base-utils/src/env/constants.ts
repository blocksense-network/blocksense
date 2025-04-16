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
export const processComposeLogsDir = join(rootDir, 'logs/process-compose');

export const getProcessComposeLogsFiles = (environment: string) => {
  const base = join(processComposeLogsDir, environment);

  return {
    'aggregate-consensus-reader': join(base, 'aggregate-consensus-reader.log'),
    'anvil-ethereum-sepolia': join(base, 'anvil-ethereum-sepolia.log'),
    'anvil-ink-sepolia': join(base, 'anvil-ink-sepolia.log'),
    'blockchain-reader': join(base, 'blockchain-reader.log'),
    'reporter-a': join(base, 'reporter-a.log'),
    sequencer: join(base, 'sequencer.log'),
  };
};
