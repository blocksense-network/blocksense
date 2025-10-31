import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { balance } from './commands/balance';
import { cost } from './commands/cost';

const command = Command.make('chain-interactions').pipe(
  Command.withSubcommands([balance, cost]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
