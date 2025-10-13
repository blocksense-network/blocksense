import { describe, expect, expectTypeOf, test } from 'vitest';

import { assertIsObject } from './assert';

describe('`base-utils/asserts` tests', () => {
  test('`assertIsObject` should narrow the type of the `value` to `object` if it is an object', () => {
    type X = { num: number } | string;
    // eslint-disable-next-line no-constant-condition
    const x: X = 2 + 2 === 4 ? { num: 4 } : 'test';
    expectTypeOf(x).toEqualTypeOf<X>();
    expectTypeOf(x).exclude<{ num: number }>().toEqualTypeOf<string>();

    const y = assertIsObject(x);
    expectTypeOf(y).toMatchTypeOf<{ num: number }>();
    expectTypeOf(y).toHaveProperty('num');
    expectTypeOf(y).not.toBeString();
    expect(y.num).toBe(4);
  });
});
