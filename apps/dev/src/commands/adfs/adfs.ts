import { Command } from '@effect/cli';

import { decode } from './decode/decode';

export const adfs = Command.make('adfs').pipe(
  Command.withSubcommands([decode]),
);
