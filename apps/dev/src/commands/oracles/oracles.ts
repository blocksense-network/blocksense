import { Command } from '@effect/cli';

import { add } from './add';
import { list } from './list';

export const oracles = Command.make('oracles').pipe(
  Command.withSubcommands([list, add]),
);
