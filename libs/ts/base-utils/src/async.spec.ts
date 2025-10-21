import { assert, describe, expect, it } from 'vitest';

import { filterAsync, loopWhile, withTimeout } from './async';

describe('async', () => {
  describe('filterAsync', () => {
    it('should filter an array based on an async predicate', async () => {
      const array = [1, 2, 3, 4, 5];
      const asyncPredicate = async (num: number) => num % 2 === 0;

      const result = await filterAsync(array, asyncPredicate);

      expect(result).toEqual([2, 4]);
    });

    it('should return an empty array if no elements pass the async predicate', async () => {
      const array = [1, 2, 3, 4, 5];
      const asyncPredicate = async (num: number) => num > 10;

      const result = await filterAsync(array, asyncPredicate);

      expect(result).toEqual([]);
    });
  });

  describe('loopWhile', () => {
    it('executes the function while the condition is true', async () => {
      let counter = 0;
      const cond = (r: number) => r < 3;
      const f = () => Promise.resolve(counter++);
      const result = await loopWhile(cond, f, 100);
      expect(result).toEqual(3);
    });

    it('waits the specified amount of time between each execution of the function', async () => {
      let counter = 0;
      const cond = (r: number) => r < 3;
      const f = () => Promise.resolve(counter++);
      const startTime = Date.now();
      await loopWhile(cond, f, 100);
      const endTime = Date.now();
      assert.closeTo(endTime - startTime, 300, 5);
    });

    it('throws an error if maxAttempts is reached', async () => {
      let counter = 0;
      const cond = () => true; // always returns true so loop never naturally exits
      const f = () => Promise.resolve(counter++);

      await expect(loopWhile(cond, f, 50, 3)).rejects.toThrow(
        'loopWhile: Reached maxAttempts (3)',
      );
    });
  });

  describe('withTimeout', () => {
    it('should resolve with the result of asyncFn if it completes within the timeout', async () => {
      const result = await withTimeout(async () => 42, 10);
      expect(result).toBe(42);
    });

    it('should reject with timeoutError if the operation times out', async () => {
      const asyncFn = async () =>
        new Promise(resolve => setTimeout(() => resolve(42), 50));
      const err = new Error('Operation timed out');

      await expect(withTimeout(asyncFn, 10, err)).rejects.toThrow(err);
    });
  });
});
