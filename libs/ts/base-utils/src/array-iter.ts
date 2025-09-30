import type { Literal, LiteralTuple, NonEmptyTuple } from './type-level';

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
export function entriesOf<K extends string, V>(
  obj: Record<K, V>,
): Array<[K, V]> {
  return Object.entries(obj) as Array<[K, V]>;
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
  entries: Array<[K, V]>,
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

/**
 * Creates a new object with the same keys as the original object, but with
 * values transformed by a given function.
 * @template K - The type of the keys in the object.
 * @template V1 - The type of the values in the input object.
 * @template V2 - The type of the values in the output object.
 * @param {Record<K, V1>} obj - The object to iterate over.
 * @param {(key: K, value: V1) => V2} fn - The function to apply to each
 * key-value pair. It receives the key and value, and should return the new
 * value.
 * @returns {Record<K, V2>} A new object with the same keys and transformed
 * values.
 */
export function mapValues<K extends string, V1, V2>(
  obj: Record<K, V1>,
  fn: (key: K, value: V1) => V2,
): Record<K, V2> {
  const result = {} as Record<K, V2>;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = fn(key as K, obj[key]);
    }
  }

  return result;
}

/**
 * Creates a new object by applying a function to each key-value pair of the
 * original object.  The function can transform both the key and the value.
 * @template K1 - The type of the keys in the input object.
 * @template K2 - The type of the keys in the output object.
 * @template V1 - The type of the values in the input object.
 * @template V2 - The type of the values in the output object.
 * @param {Record<K1, V1>} obj - The object to iterate over.
 * @param {(key: K1, value: V1) => [K2, V2]} fn - The function to apply to each
 * key-value pair. It should return a new [key, value] pair.
 * @returns {Record<K2, V2>} A new object with transformed keys and values.
 */
export function mapEntries<K1 extends string, K2 extends string, V1, V2>(
  obj: Record<K1, V1>,
  fn: (key: K1, value: V1) => [K2, V2],
): Record<K2, V2> {
  const result = {} as Record<K2, V2>;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const [newKey, newValue] = fn(key as K1, obj[key]);
      result[newKey] = newValue;
    }
  }

  return result;
}

/**
 * Filters the entries of an object based on a predicate function.
 * This is useful for type-safe filtering of object entries.
 * @template K1 - The original key type.
 * @template K2 - The filtered key type.
 * @template V1 - The original value type.
 * @template V2 - The filtered value type.
 * @param {Record<K1, V1>} obj - The object to filter.
 * @param {(pair: [K1, V1]) => pair is [K2, V2]} predicate - A type guard
 * function that returns true for entries to keep.
 * @returns {Record<K2, V2>} A new object with the filtered entries.
 */
export function filterEntries<
  K1 extends string,
  K2 extends K1,
  V1,
  V2 extends V1,
>(
  obj: Record<K1, V1>,
  keyPredicate: (key: K1) => key is K2,
  valuePredicate: (value: V1) => value is V2,
): Record<K2, V2> {
  const result = {} as Record<K2, V2>;

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    if (!keyPredicate(key)) continue;
    const v = obj[key];
    if (valuePredicate(v)) {
      result[key] = v;
    }
  }

  return result;
}

/**
 * Maps the values of an object to promises and returns a promise that resolves
 * to a new object with the resolved values.
 * @template K - The type of the keys.
 * @template V1 - The type of the original values.
 * @template V2 - The type of the resolved values.
 * @param {Record<K, V1>} obj - The object to map.
 * @param {(key: K, value: V1) => Promise<V2>} fn - The function that returns a
 * promise for the new value.
 * @returns {Promise<Record<K, V2>>} A promise that resolves to a new object
 * with the same keys and resolved values.
 */
export async function mapValuePromises<K extends string, V1, V2>(
  obj: Record<K, V1>,
  fn: (key: K, value: V1) => Promise<V2>,
): Promise<Record<K, V2>> {
  const entries = entriesOf(obj);
  const newEntries = await Promise.all(entries.map(([k, v]) => fn(k, v)));

  const res = {} as Record<K, V2>;

  for (let i = 0; i < entries.length; i++) {
    res[entries[i][0]] = newEntries[i];
  }

  return res;
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
