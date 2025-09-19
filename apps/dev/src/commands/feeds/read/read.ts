import { Command } from '@effect/cli';

import { adfs } from './adfs';
import { clAdapter } from './cl-adapter';

export const read = Command.make('read').pipe(
  Command.withSubcommands([adfs, clAdapter]),
);
