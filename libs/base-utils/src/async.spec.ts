import { describe, expect, it } from 'vitest';

import { filterAsync } from './async';

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
