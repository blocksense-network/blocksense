export function entries<K extends string, V>(obj: Record<K, V>): [K, V][] {
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
