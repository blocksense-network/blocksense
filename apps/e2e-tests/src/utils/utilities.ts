export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export function pow10(n: number): bigint {
  if (n < 0) throw new Error('pow10: n must be >= 0');
  let p = 1n;
  for (let i = 0; i < n; i++) p *= 10n;
  return p;
}

export function bigIntToBytesBE(x: bigint): Buffer {
  if (x < 0n) throw new Error('bigIntToBytesBE: negative not supported');
  if (x === 0n) return Buffer.from([0]);

  const bytes: Array<number> = [];
  let n = x;
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  bytes.reverse();
  return Buffer.from(bytes);
}
