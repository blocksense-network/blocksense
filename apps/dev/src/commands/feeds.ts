import { Command } from '@effect/cli';

import { list } from './feeds/list/list';

export const feeds = Command.make('feeds').pipe(
  Command.withSubcommands([list]),
);
