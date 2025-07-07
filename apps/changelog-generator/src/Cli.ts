import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { listFeeds } from './commands/list-feeds';

const command = Command.make('changelog-generator').pipe(
  Command.withSubcommands([listFeeds]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
