import { describe, expect, test } from 'vitest';
import { arrayToObject } from './array-iter';

describe('`base-utils/array-iter` tests', () => {
  describe('arrayToObject', () => {
    test('should convert array using any field as key', () => {
      const input = [
        { name: 'a', value: 'some' },
        { name: 'b', value: 'cool' },
      ];
      const res1 = arrayToObject(input, 'name');
      expect(res1).toEqual({
        a: { value: 'some' },
        b: { value: 'cool' },
      });

      const res2 = arrayToObject(input, 'value');
      expect(res2).toEqual({
        some: { name: 'a' },
        cool: { name: 'b' },
      });
    });

    test('should work with numeric keys', () => {
      const input = [
        { id: 1, value: 'x' },
        { id: 2, value: 'y' },
      ];
      const result = arrayToObject(input, 'id');
      expect(result).toEqual({
        '1': { value: 'x' },
        '2': { value: 'y' },
      });
    });

    test('should handle empty array', () => {
      const result = arrayToObject([], 'id' as any);
      expect(result).toEqual({});
    });

    test('should support nested values', () => {
      const input = [
        { id: 'x', data: { foo: 'bar' } },
        { id: 'y', data: { foo: 'baz' } },
      ];
      const result = arrayToObject(input, 'id');
      expect(result).toEqual({
        x: { data: { foo: 'bar' } },
        y: { data: { foo: 'baz' } },
      });
    });
  });
});
