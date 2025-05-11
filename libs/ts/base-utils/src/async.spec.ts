import { describe, expect, it } from 'vitest';

import { filterAsync, loopWhile } from './async';

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
    expect(endTime - startTime).toBeGreaterThanOrEqual(300);
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
