import { Literal, LiteralTuple, NonEmptyTuple } from './type-level';

/**
 * Returns an array of a given object's own enumerable string-keyed property
 * names. This is a typed version of `Object.keys`.
 * @template K - The type of the keys.
 * @param {Record<K, unknown>} obj - The object to get the keys from.
 * @returns {K[]} An array of the object's keys.
 */
export function keysOf<K extends string>(obj: Record<K, unknown>): K[] {
  return Object.keys(obj) as K[];
}

/**
 * Returns an array of a given object's own enumerable string-keyed property
 * values. This is a typed version of `Object.values`.
 * @template K - The type of the keys.
 * @template V - The type of the values.
 * @param {Record<K, V>} obj - The object to get the values from.
 * @returns {V[]} An array of the object's values.
 */
export function valuesOf<K extends string, V>(obj: Record<K, V>): V[] {
  return Object.values(obj) as V[];
}

/**
 * Returns an array of a given object's own enumerable string-keyed property
 * [key, value] pairs.
 * This is a typed version of `Object.entries`.
 * @template K - The type of the keys.
 * @template V - The type of the values.
 * @param {Record<K, V>} obj - The object to get the entries from.
 * @returns {[K, V][]} An array of the object's [key, value] pairs.
 */
export function entriesOf<K extends string, V>(obj: Record<K, V>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

/**
 * Transforms a list of key-value pairs into an object.
 * This is a typed version of `Object.fromEntries`.
 * @template K - The type of the keys.
 * @template V - The type of the values.
 * @param {[K, V][]} entries - An array of key-value pairs.
 * @returns {Record<K, V>} The new object.
 */
export function fromEntries<K extends string, V>(
  entries: [K, V][],
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

/**
 * Creates a tuple from a list of arguments, ensuring literal types are
 * preserved.
 */
export function tuple<Args extends NonEmptyTuple<T>, T extends Literal>(
  ...args: Args
): Args;
export function tuple<Args extends LiteralTuple>(...args: Args): Args {
  return args;
}

/**
 * Converts an array of objects into a record, using a specified field as the
 * key.
 *
 * @template T - The shape of each object in the input array.
 * @template K - The key of each object to use as the record key.
 * @template R - The shape of the resulting values in the record (defaults to T
 * without the key field).
 *
 * @param {T[]} arr - The input array of objects.
 * @param {K} keyField - The key within each object to use as the output
 * record's key.
 *
 * @returns {Record<string, R>} A record object with keys from `keyField` and
 * values as the rest of the object.
 *
 * @example
 * const input = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' },
 * ];
 * const result = arrayToObject(input, 'id');
 * // result = {
 * //   '1': { name: 'Alice' },
 * //   '2': { name: 'Bob' },
 * // }
 */
export function arrayToObject<T, K extends keyof T, R = Omit<T, K>>(
  arr: T[],
  keyField: K,
): Record<string, R> {
  return fromEntries(
    arr.map(item => {
      const { [keyField]: key, ...rest } = item;
      return [String(key), rest] as [string, R];
    }),
  );
}
