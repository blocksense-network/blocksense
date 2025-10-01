import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { adfs } from './commands/adfs/adfs';
import { feeds } from './commands/feeds/feeds';
import { oracles } from './commands/oracles/oracles';
import { networks } from './commands/networks/networks';

const command = Command.make('dev').pipe(
  Command.withSubcommands([feeds, oracles, adfs, networks]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
