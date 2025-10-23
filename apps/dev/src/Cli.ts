import { Command } from '@effect/cli';

import packageJson from '../package.json';

import { adfs } from './commands/adfs/adfs';
import { decoder } from './commands/decoder/decoder';
import { feeds } from './commands/feeds/feeds';
import { networks } from './commands/networks/networks';
import { oracles } from './commands/oracles/oracles';

const command = Command.make('dev').pipe(
  Command.withSubcommands([feeds, oracles, adfs, networks, decoder]),
);

export const run = Command.run(command, {
  name: packageJson.description,
  version: packageJson.version,
});
