import { Command } from '@effect/cli';

import { list } from './feeds/list/list';
import { adfs } from './feeds/read/adfs';
import { clAdapter } from './feeds/read/cl-adapter';

const read = Command.make('read').pipe(
  Command.withSubcommands([adfs, clAdapter]),
);

export const feeds = Command.make('feeds').pipe(
  Command.withSubcommands([list, read]),
);
