import { Command } from '@effect/cli';

import { list } from './list/list';
import { read } from './read/read';

export const feeds = Command.make('feeds').pipe(
  Command.withSubcommands([list, read]),
);
