export function* keysOf<K extends string>(
  obj: Record<K, unknown>,
): Generator<K> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) yield key;
  }
}

export function* valuesOf<K extends string, V>(
  obj: Record<K, V>,
): Generator<V> {
  for (const key of keysOf(obj)) {
    yield obj[key];
  }
}

export function* entriesOf<K extends string, V>(
  obj: Record<K, V>,
): Generator<[K, V]> {
  for (const key of keysOf(obj)) {
    yield [key, obj[key]];
  }
}

export function fromEntries<K extends string, V>(
  entries: [K, V][],
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

export function tuple<Args extends any[]>(...args: Args): Args {
  return args;
}
