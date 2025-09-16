import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { readClAdapter } from './commands/read-cl-adapter';
import { readAdfs } from './commands/read-adfs';
import { feeds } from './commands/feeds';

const command = Command.make('dev').pipe(
  Command.withSubcommands([feeds, readClAdapter, readAdfs]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
