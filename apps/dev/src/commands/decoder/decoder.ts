import { Command } from '@effect/cli';

import { generateDecoder } from './generate-decoder/generate-decoder';

export const decoder = Command.make('decoder').pipe(
  Command.withSubcommands([generateDecoder]),
);
