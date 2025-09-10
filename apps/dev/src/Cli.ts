import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { listFeeds } from './commands/list-feeds';
import { readClAdapter } from './commands/read-cl-adapter';
import { readAdfs } from './commands/read-adfs';

const command = Command.make('dev').pipe(
  Command.withSubcommands([listFeeds, readClAdapter, readAdfs]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
