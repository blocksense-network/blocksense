import { arrayToHex, skip0x } from '@blocksense/base-utils';
import bls from '@chainsafe/bls';

function u128ToBytes(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(16);
  const view = new DataView(buf);

  const hi = value >> 64n;
  const lo = value & ((1n << 64n) - 1n);

  view.setBigUint64(0, hi, false);
  view.setBigUint64(8, lo, false);

  return new Uint8Array(buf);
}

export type FeedType =
  | { kind: 'Numerical'; value: number }
  | { kind: 'Text'; value: string }
  | { kind: 'Bytes'; value: Uint8Array };

export type FeedError =
  | { kind: 'APIError'; message: string }
  | { kind: 'UndefinedError' };

export type FeedResult =
  | { Ok: true; value: FeedType }
  | { Ok: false; error: FeedError };

function u64ToBytes(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, value, false);
  return new Uint8Array(buf);
}

function feedTypeToBytes(feed: FeedType, timestamp: bigint): Uint8Array {
  const ts64 = u64ToBytes(timestamp & ((1n << 64n) - 1n));

  switch (feed.kind) {
    case 'Numerical': {
      const scaled = BigInt(Math.floor(feed.value * 1e18));

      const buf = new ArrayBuffer(24);
      const view = new DataView(buf);
      const hi = scaled >> 64n;
      const lo = scaled & ((1n << 64n) - 1n);
      view.setBigUint64(0, hi, false);
      view.setBigUint64(16, lo, false);

      const numBytes = new Uint8Array(buf);

      return new Uint8Array([...numBytes, ...ts64]);
    }

    case 'Text': {
      const textBytes = new TextEncoder().encode(feed.value);
      return new Uint8Array([...textBytes, ...ts64]);
    }

    case 'Bytes': {
      return new Uint8Array([...feed.value, ...ts64]);
    }
  }
}

export async function generateSignature(
  privKeyHex: string,
  feedId: string,
  timestamp: bigint,
  feedResult: FeedResult,
): Promise<string> {
  const feedIdBytes = new TextEncoder().encode(feedId);
  const tsBytes = u128ToBytes(timestamp);

  let byteBuffer = new Uint8Array([...feedIdBytes, ...tsBytes]);

  if (feedResult.Ok) {
    try {
      const valueBytes = feedTypeToBytes(feedResult.value, timestamp);
      byteBuffer = new Uint8Array([...byteBuffer, ...valueBytes]);
    } catch (err) {
      console.warn(`Error converting to bytes recvd result of vote: ${err}`);
    }
  } else {
    console.warn(
      `Error parsing recvd result of vote: ${
        feedResult.error.kind === 'APIError'
          ? feedResult.error.message
          : 'UndefinedError'
      }`,
    );
  }

  const secretKey = bls.SecretKey.fromHex(privKeyHex);
  const sig = secretKey.sign(byteBuffer);
  return sig.toHex();
}

const sig = await generateSignature(
  '536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003',
  '100002',
  1755685551079n,
  {
    Ok: true,
    value: {
      kind: 'Numerical',
      value: 1,
    },
  },
);
console.log('sig: ', sig);
