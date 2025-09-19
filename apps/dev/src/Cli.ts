import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { feeds } from './commands/feeds/feeds';
import { adfs } from './commands/adfs/adfs';

const command = Command.make('dev').pipe(
  Command.withSubcommands([feeds, adfs]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
