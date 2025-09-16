import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { feeds } from './commands/feeds';

const command = Command.make('dev').pipe(Command.withSubcommands([feeds]));

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
