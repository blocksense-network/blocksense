import { Command } from '@effect/cli';
import { list } from './list';
import { add } from './add';

export const networks = Command.make('networks').pipe(
  Command.withSubcommands([list, add]),
);
