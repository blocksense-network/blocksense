import { describe, expect, test } from 'vitest';
import {
  arrayToObject,
  entriesOf,
  filterEntries,
  fromEntries,
  keysOf,
  mapEntries,
  mapValuePromises,
  mapValues,
  tuple,
  valuesOf,
} from './array-iter';

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

  describe('keysOf', () => {
    test('should return an array of a given object keys', () => {
      const obj = { a: 1, b: '2', c: true };
      expect(keysOf(obj)).toEqual(['a', 'b', 'c']);
    });

    test('should return an empty array for an empty object', () => {
      expect(keysOf({})).toEqual([]);
    });
  });

  describe('valuesOf', () => {
    test('should return an array of a given object values', () => {
      const obj = { a: 1, b: '2', c: true };
      expect(valuesOf(obj)).toEqual([1, '2', true]);
    });

    test('should return an empty array for an empty object', () => {
      expect(valuesOf({})).toEqual([]);
    });
  });

  describe('entriesOf', () => {
    test('should return an array of a given object entries', () => {
      const obj = { a: 1, b: '2' };
      expect(entriesOf(obj)).toEqual([
        ['a', 1],
        ['b', '2'],
      ]);
    });

    test('should return an empty array for an empty object', () => {
      expect(entriesOf({})).toEqual([]);
    });
  });

  describe('fromEntries', () => {
    test('should transform a list of key-value pairs into an object', () => {
      const entries: [string, number][] = [
        ['a', 1],
        ['b', 2],
      ];
      expect(fromEntries(entries)).toEqual({ a: 1, b: 2 });
    });

    test('should return an empty object for an empty array', () => {
      expect(fromEntries([])).toEqual({});
    });
  });

  describe('mapValues', () => {
    test('should create a new object with transformed values', () => {
      const obj = { a: 1, b: 2 };
      const result = mapValues(obj, (key, value) => `${key}-${value * 2}`);
      expect(result).toEqual({ a: 'a-2', b: 'b-4' });
    });

    test('should return an empty object for an empty object', () => {
      expect(mapValues({}, () => 'whatever')).toEqual({});
    });
  });

  describe('mapEntries', () => {
    test('should create a new object with transformed keys and values', () => {
      const obj = { a: 1, b: 2 };
      const result = mapEntries(obj, (key, value) => [`key_${key}`, value * 2]);
      expect(result).toEqual({ key_a: 2, key_b: 4 });
    });

    test('should return an empty object for an empty object', () => {
      expect(mapEntries({}, () => ['a', 1])).toEqual({});
    });
  });

  describe('filterEntries', () => {
    test('should filter entries of an object based on a predicate', () => {
      const obj = { a: 1, b: '2', c: 3, d: '4' };
      const result = filterEntries(
        obj,
        key => key === 'a' || key === 'c',
        value => typeof value === 'number',
      );
      expect(result).toEqual({ a: 1, c: 3 });
    });

    test('should return an empty object if no entries match', () => {
      const obj = { a: '1', b: '2' };
      const result = filterEntries(
        obj,
        (pair): pair is [string, number] => typeof pair[1] === 'number',
      );
      expect(result).toEqual({});
    });
  });

  describe('mapValuePromises', () => {
    test('should map values to promises and resolve to a new object', async () => {
      const obj = { a: 1, b: 2 };
      const result = await mapValuePromises(obj, async (key, value) => {
        return Promise.resolve(`${key}-${value * 2}`);
      });
      expect(result).toEqual({ a: 'a-2', b: 'b-4' });
    });

    test('should handle empty object', async () => {
      const result = await mapValuePromises({}, async () => Promise.resolve(1));
      expect(result).toEqual({});
    });
  });

  describe('tuple', () => {
    test('should create a tuple from arguments', () => {
      expect(tuple('a')).toEqual(['a']);
      expect(tuple('a', 'b', 1)).toEqual(['a', 'b', 1]);
    });
  });
});
