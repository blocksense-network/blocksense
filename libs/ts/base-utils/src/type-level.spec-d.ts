import { describe, expectTypeOf, it } from 'vitest';
import { UnionToIntersection } from './type-level';

describe('`base-utils/type-level` tests', () => {
  describe('UnionToIntersection', () => {
    it('should intersect a union of simple types', () => {
      type A = { a: string };
      type B = { b: number };
      type C = { c: boolean };

      expectTypeOf<UnionToIntersection<A | B | C>>().toEqualTypeOf<A & B & C>();
    });
  });
});
