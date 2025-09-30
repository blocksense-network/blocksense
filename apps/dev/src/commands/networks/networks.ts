import { Command } from '@effect/cli';

import { list } from './list';

export const networks = Command.make('networks').pipe(
  Command.withSubcommands([list]),
);
