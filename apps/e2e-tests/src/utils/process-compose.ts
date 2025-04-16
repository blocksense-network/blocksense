import { ParseResult, Schema as S } from 'effect';
import { $ } from 'execa';
import { logProcessComposeInfo } from './logs';

const ProcessComposeStatusSchema = S.mutable(
  S.Array(
    // The fields below are commented out because they are not used in the current implementation
    // but are kept for future reference or potential use.
    S.Struct({
      name: S.String,
      // namespace: S.String,
      status: S.String,
      // system_time: S.String,
      // age: S.Number,
      // is_ready: S.String,
      // restarts: S.Number,
      exit_code: S.Number,
      // pid: S.Number,
      // is_elevated: S.Boolean,
      // password_provided: S.Boolean,
      // mem: S.Number,
      // cpu: S.Number,
      // IsRunning: S.Boolean,
    }),
  ),
);

const arrayToObject = <T, R>(
  arr: Array<{ name: string } & T>,
): Record<string, R> =>
  Object.fromEntries(
    arr.map(({ name, ...rest }) => [name, rest] as [string, R]),
  );

export async function parseProcessesStatus() {
  return await $`process-compose process list -o json`.then(({ stdout }) =>
    arrayToObject(
      ParseResult.decodeUnknownSync(ProcessComposeStatusSchema)(
        JSON.parse(stdout),
      ),
    ),
  );
}

export async function processComposeOrchestration(
  action: 'start' | 'stop',
): Promise<void> {
  switch (action) {
    case 'start':
      logProcessComposeInfo('Starting');
      await $`process-compose up -D`;
      break;
    case 'stop':
      logProcessComposeInfo('Stopping');
      await $`process-compose down`;
      break;
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}
