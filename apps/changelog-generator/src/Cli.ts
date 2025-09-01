import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { listFeeds } from './commands/list-feeds';
import { sayHello } from './commands/say-hello';

const command = Command.make('changelog-generator').pipe(
  Command.withSubcommands([listFeeds, sayHello]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
