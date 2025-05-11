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

export function tuple<Args extends any[]>(...args: Args): Args {
  return args;
}
