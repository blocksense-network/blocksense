import * as Command from '@effect/cli/Command';

import packageJson from '../package.json';
import { setupSandbox } from './common';

const command = Command.make('hello relayer');

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
