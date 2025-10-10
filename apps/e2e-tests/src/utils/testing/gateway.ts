import { pipe } from 'effect';
import { afterEach, beforeEach } from '@effect/vitest';

/**
 * Installs per-suite fail-fast behavior: once any test in the suite fails,
 * all subsequent tests in the same suite are skipped.
 *
 * Usage:
 *   describe.sequential('suite', () => {
 *     installFailFastForSuite();
 *     // ... tests
 *   });
 */
export function installFailFastForSuite(): void {
  installSkipAfterSpecificFailure(() => true);
}

export type TestMatch =
  | string
  | RegExp
  | ((taskName: string, context: any) => boolean);

/**
 * Installs per-suite skip behavior that triggers only when a specific test fails.
 * Subsequent tests in the suite are skipped once the target test has failed.
 *
 * The match can be:
 * - string: exact test name match
 * - RegExp: pattern tested against the test name
 * - (name, context) => boolean: custom predicate
 */
export function installSkipAfterSpecificFailure(match: TestMatch): void {
  let skipRemaining: boolean = false;

  const isFailureState = (state: string | undefined): boolean =>
    state === 'fail' || state === 'failed';

  const getTaskName = (ctx: any): string | undefined => ctx?.task?.name;
  const getTaskState = (ctx: any): string | undefined =>
    ctx?.task?.result?.state;

  const predicate = toPredicate(match);

  beforeEach((ctx: any) => {
    if (skipRemaining && typeof ctx?.skip === 'function') {
      ctx.skip();
    }
  });

  afterEach((ctx: any) => {
    if (skipRemaining) return;

    const name = getTaskName(ctx);
    if (!name) return;

    const state = getTaskState(ctx);
    if (!isFailureState(state)) return;

    if (predicate(name, ctx)) {
      skipRemaining = true;
    }
  });
}

const toPredicate =
  (match: TestMatch) =>
  (name: string, ctx: any): boolean =>
    pipe(
      match,
      m => (typeof m === 'string' ? name === m : m),
      m => (m instanceof RegExp ? m.test(name) : m),
      m => (typeof m === 'function' ? m(name, ctx) : (m as unknown as boolean)),
    );
