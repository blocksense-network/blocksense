import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { watcher } from './commands/watcher/watcher';

const command = Command.make('adfs-indexer').pipe(
  Command.withSubcommands([watcher]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
