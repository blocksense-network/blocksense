import * as Command from '@effect/cli/Command';

const command = Command.make('hello relayer');

export const run = Command.run(command, {
  name: 'AVM Relayer',
  version: '0.0.1',
});
