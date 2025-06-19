import { Command } from '@effect/cli';

import { listFeeds } from './commands/list-feeds';

const command = Command.make('changelog-generator').pipe(
  Command.withSubcommands([listFeeds]),
);

export const run = Command.run(command, {
  name: 'Changelog Generator',
  version: '0.1.0',
});
