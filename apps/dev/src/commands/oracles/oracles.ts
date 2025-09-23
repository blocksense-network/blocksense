import { Command } from '@effect/cli';

import { list } from './list';
import { add } from './add';

export const oracles = Command.make('oracles').pipe(
  Command.withSubcommands([list, add]),
);
