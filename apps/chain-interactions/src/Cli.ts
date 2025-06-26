import { Command } from '@effect/cli';

import packageJson from '../package.json';

const command = Command.make('<command_name>');

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
