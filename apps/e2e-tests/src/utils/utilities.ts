import { Data, Effect } from 'effect';
import { Command } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';

import { logMessage } from './logs';

export function logTestEnvironmentInfo(
  status: 'Starting' | 'Stopping',
  name?: string,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const time = new Date();
    logMessage(
      'info',
      `${status} test environment${name ? `: ${name}` : ''}...`,
      `${status} time: ${time.toDateString()} ${time.toTimeString()}`,
    );
  });
}

export class RGLogCheckerError extends Data.TaggedError(
  '@e2e-tests/RGLogCheckerError',
)<{
  cause: unknown;
}> {}

export const rgSearchPattern = ({
  caseInsensitive = true,
  file,
  flags = [],
  pattern,
}: {
  caseInsensitive?: boolean;
  file: string;
  flags?: string[];
  pattern: string;
}): Effect.Effect<boolean, RGLogCheckerError> => {
  const args = caseInsensitive
    ? ['--quiet', '-i', ...flags, pattern, file]
    : ['--quiet', ...flags, pattern, file];

  return Command.make('rg', ...args).pipe(
    Command.exitCode,
    Effect.matchEffect({
      onFailure: commandError =>
        Effect.fail(new RGLogCheckerError({ cause: commandError })),
      onSuccess: exitCode => {
        if (exitCode === 0) {
          return Effect.succeed(true);
        }
        if (exitCode === 1) {
          return Effect.succeed(false);
        }
        return Effect.fail(
          new RGLogCheckerError({
            cause: `ripgrep process error: exited with code ${exitCode}`,
          }),
        );
      },
    }),
    Effect.provide(NodeContext.layer),
  );
};

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export function powerOf10BigInt(n: number): bigint {
  if (!Number.isInteger(n))
    throw new Error('powerOf10BigInt: n must be an integer');
  if (n < 0) throw new Error('powerOf10BigInt: n must be >= 0');
  let p = 1n;
  for (let i = 0; i < n; i++) p *= 10n;
  return p;
}

export function bigIntToBytesBE(x: bigint): Buffer {
  if (x < 0n) throw new Error('bigIntToBytesBE: negative input not supported');
  if (x === 0n) return Buffer.from([0]);

  const bytes: number[] = [];
  let n = x;
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  bytes.reverse();
  return Buffer.from(bytes);
}

export function bytesToBigIntBE(buf: Buffer): bigint {
  let acc = 0n;
  for (const b of buf) acc = (acc << 8n) | BigInt(b);
  return acc;
}
