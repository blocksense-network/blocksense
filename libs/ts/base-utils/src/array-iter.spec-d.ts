import { describe, expect, expectTypeOf, it } from 'vitest';

import { filterEntries, tuple } from './array-iter';

describe('`base-utils/array-iter` type level tests', () => {
  describe('filterEntries', () => {
    it('should filter entries based on key and value predicates', () => {
      const obj = { a: 1, b: '2', c: 3, d: '4' };
      const result = filterEntries(
        obj,
        key => key === 'a' || key === 'c',
        value => typeof value === 'number',
      );
      expectTypeOf(result).toEqualTypeOf<{
        a: number;
        c: number;
      }>();
      expect(result).toEqual({ a: 1, c: 3 });
    });
  });

  describe('`tuple`', () => {
    it('should preserve literal types', () => {
      const x = tuple('a', 'b', 'c');
      const y = tuple('a', true, false, 5n, `${6n}`);
      const z = tuple('a', true, false, 5n, `${6n}`, ['a', 'b', 'c'], {
        a: 'a',
        b: 1,
        c: true,
      });
      expectTypeOf(x).toEqualTypeOf<['a', 'b', 'c']>();
      expectTypeOf(y).toEqualTypeOf<['a', true, false, 5n, '6']>();
      expectTypeOf(z).toEqualTypeOf<
        [
          'a',
          true,
          false,
          5n,
          '6',
          [string, string, string],
          {
            a: string;
            b: number;
            c: true;
          },
        ]
      >();
    });

    it('should preserve literal types when nested in object', () => {
      const x = {
        a: tuple('a', 'b', 'c'),
        b: tuple('a', true, false, 5n, `${6n}`),
        c: tuple('a', true, false, 5n, `${6n}`, ['a', 'b', 'c'], {
          a: 'a',
          b: 1,
          c: true,
        }),
      } satisfies {
        a: string[];
        b: unknown[];
        c: unknown[];
      };
      expectTypeOf(x).toEqualTypeOf<{
        a: ['a', 'b', 'c'];
        b: ['a', true, false, 5n, '6'];
        c: [
          'a',
          true,
          false,
          5n,
          '6',
          [string, string, string],
          {
            a: string;
            b: number;
            c: true;
          },
        ];
      }>();
    });
  });
});
