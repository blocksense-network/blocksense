import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { balance } from './commands/balance';

const command = Command.make('chain-interactions').pipe(
  Command.withSubcommands([balance]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
