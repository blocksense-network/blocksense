import { Literal, LiteralTuple, NonEmptyTuple } from './type-level';

export function keysOf<K extends string>(obj: Record<K, unknown>): K[] {
  return Object.keys(obj) as K[];
}

export function valuesOf<K extends string, V>(obj: Record<K, V>): V[] {
  return Object.values(obj) as V[];
}

export function entriesOf<K extends string, V>(obj: Record<K, V>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

export function fromEntries<K extends string, V>(
  entries: [K, V][],
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

export function tuple<Args extends NonEmptyTuple<T>, T extends Literal>(
  ...args: Args
): Args;
export function tuple<Args extends LiteralTuple>(...args: Args): Args {
  return args;
}

/**
 * Converts an array of objects into a record, using a specified field as the key.
 *
 * @template T - The shape of each object in the input array.
 * @template K - The key of each object to use as the record key.
 * @template R - The shape of the resulting values in the record (defaults to T without the key field).
 *
 * @param {T[]} arr - The input array of objects.
 * @param {K} keyField - The key within each object to use as the output record's key.
 *
 * @returns {Record<string, R>} A record object with keys from `keyField` and values as the rest of the object.
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
