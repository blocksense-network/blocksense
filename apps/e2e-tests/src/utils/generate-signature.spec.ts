import bls from '@chainsafe/bls';
import { afterAll, beforeEach, describe, expect, it, vi } from '@effect/vitest';
import { Effect } from 'effect';

import {
  asBytes,
  type FeedResult,
  type FeedType,
  generateSignature,
} from './generate-signature';
import { bytesToBigIntBE } from './utilities';

const toBE8 = (x: bigint) => {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64BE(x, 0);
  return buf;
};

describe('asBytes', () => {
  it.effect(
    'encodes Numerical feed with scaling, padding and timestamp appended',
    () =>
      Effect.gen(function* () {
        const feed: FeedType = { Numerical: 42 };
        const timestamp = 1234567890123456789n;

        const out = yield* asBytes(feed, timestamp, 18);

        expect(out.length).toBe(32); // 24-byte value + 8-byte timestamp

        const valueBytes = out.subarray(0, 24);
        const timestampBytes = out.subarray(24);

        expect(timestampBytes.equals(toBE8(timestamp))).toBe(true);

        const expectedScaledValue = 42n * 10n ** 18n;
        const decodedScaledValue = bytesToBigIntBE(valueBytes);
        expect(decodedScaledValue).toBe(expectedScaledValue);
      }),
  );

  it.effect(
    'encodes Numerical feed with fractional part and truncates to 18 digits',
    () =>
      Effect.gen(function* () {
        // 1.234567890123456789999 -> fractional truncated to 18 digits
        const feed: FeedType = { Numerical: Number('1.2345678901234568') };
        const timestamp = 777n;

        const out = yield* asBytes(feed, timestamp, 18);
        expect(out.length).toBe(32);

        const valueBytes = out.subarray(0, 24);
        const timestampBytes = out.subarray(24);

        expect(timestampBytes.equals(toBE8(timestamp))).toBe(true);
        const decodedValue = bytesToBigIntBE(valueBytes);
        expect(
          decodedValue >= 10n ** 18n && decodedValue < 2n * 10n ** 18n,
        ).toBe(true);
      }),
  );

  it.effect(
    'returns raw UTF-8 bytes for Text feed (no timestamp appended)',
    () =>
      Effect.gen(function* () {
        const feed: FeedType = { Text: 'hello-world' };
        const timestamp = 999n;
        const out = yield* asBytes(feed, timestamp, 18);
        expect(out.equals(Buffer.from('hello-world'))).toBe(true);
      }),
  );

  it.effect(
    'returns provided bytes for Bytes feed (no timestamp appended)',
    () =>
      Effect.gen(function* () {
        const feed: FeedType = { Bytes: [0, 1, 2, 250, 255] };
        const out = yield* asBytes(feed, 0n, 18);
        expect(out.equals(Buffer.from([0, 1, 2, 250, 255]))).toBe(true);
      }),
  );

  it.effect('fails on invalid feed type', () =>
    Effect.gen(function* () {
      const invalid: any = { Unknown: 1 };
      const res = yield* Effect.exit(asBytes(invalid as FeedType, 0n, 18));
      expect(res._tag).toBe('Failure');
    }),
  );
});

describe('generateSignature', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let signMock: ReturnType<typeof vi.fn>;
  let capturedSignedMessageBuffer: Buffer | null = null;
  const TEST_PRIV_HEX = '11'.repeat(32);

  beforeEach(() => {
    capturedSignedMessageBuffer = null;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    signMock = vi.fn((message: Uint8Array) => {
      capturedSignedMessageBuffer = Buffer.from(message);
      return { toHex: () => '0xstub' } as any;
    });
    vi.spyOn((bls as any).SecretKey, 'fromHex' as any).mockReturnValue({
      sign: signMock,
    } as any);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it.effect(
    'composes message: feedId + 16-byte ts + asBytes(Numerical) for Ok',
    () =>
      Effect.gen(function* () {
        const feedId = 'FEED_ETHUSD';
        const timestamp = 123456789n;
        const feed: FeedResult = { Ok: { Numerical: 12.34 } };

        // Build message bytes identical to generateSignature
        const feedIdBytes = Buffer.from(feedId);
        const timestampBuf = Buffer.allocUnsafe(16);
        timestampBuf.writeBigUInt64BE(timestamp, 8);
        let messageBytes = Buffer.concat([feedIdBytes, timestampBuf]);
        const appendedValueBytes = yield* asBytes(
          { Numerical: 12.34 },
          timestamp,
          18,
        );
        messageBytes = Buffer.concat([messageBytes, appendedValueBytes]);

        const sigHex = yield* generateSignature(
          TEST_PRIV_HEX,
          feedId,
          timestamp,
          feed,
        );
        expect(sigHex).toBe('0xstub');
        expect(signMock).toHaveBeenCalledTimes(1);
        expect(capturedSignedMessageBuffer!.equals(messageBytes)).toBe(true);
      }),
  );

  it.effect(
    'composes message: feedId + 16-byte ts + Text bytes for Ok(Text)',
    () =>
      Effect.gen(function* () {
        const feedId = 'FEED_NEWS';
        const timestamp = 42n;
        const text = 'Breaking: Hello';
        const feed: FeedResult = { Ok: { Text: text } };

        const feedIdBytes = Buffer.from(feedId);
        const timestampBuf = Buffer.allocUnsafe(16);
        timestampBuf.writeBigUInt64BE(timestamp, 8);
        const messageBytes = Buffer.concat([
          feedIdBytes,
          timestampBuf,
          Buffer.from(text),
        ]);

        const sigHex = yield* generateSignature(
          TEST_PRIV_HEX,
          feedId,
          timestamp,
          feed,
        );
        expect(sigHex).toBe('0xstub');
        expect(signMock).toHaveBeenCalledTimes(1);
        expect(capturedSignedMessageBuffer!.equals(messageBytes)).toBe(true);
      }),
  );

  it.effect('composes message: feedId + 16-byte ts + Bytes for Ok(Bytes)', () =>
    Effect.gen(function* () {
      const feedId = 'FEED_BYTES';
      const timestamp = 2025n;
      const rawBytes = [0, 1, 2, 250, 255, 10, 20];
      const feed: FeedResult = { Ok: { Bytes: rawBytes } };

      const feedIdBytes = Buffer.from(feedId);
      const timestampBuf = Buffer.allocUnsafe(16);
      timestampBuf.writeBigUInt64BE(timestamp, 8);
      const messageBytes = Buffer.concat([
        feedIdBytes,
        timestampBuf,
        Buffer.from(rawBytes),
      ]);

      const sigHex = yield* generateSignature(
        TEST_PRIV_HEX,
        feedId,
        timestamp,
        feed,
      );
      expect(sigHex).toBe('0xstub');
      expect(signMock).toHaveBeenCalledTimes(1);
      expect(capturedSignedMessageBuffer!.equals(messageBytes)).toBe(true);
    }),
  );

  it.effect('logs warning and omits value on Err(APIError)', () =>
    Effect.gen(function* () {
      const feedId = 'FEED_X';
      const timestamp = 1n;
      const feed: FeedResult = { Err: { APIError: 'boom' } };

      const feedIdBytes = Buffer.from(feedId);
      const timestampBuf = Buffer.allocUnsafe(16);
      timestampBuf.writeBigUInt64BE(timestamp, 8);
      const messageBytes = Buffer.concat([feedIdBytes, timestampBuf]);

      const sigHex = yield* generateSignature(
        TEST_PRIV_HEX,
        feedId,
        timestamp,
        feed,
      );
      expect(sigHex).toBe('0xstub');
      expect(signMock).toHaveBeenCalledTimes(1);
      expect(capturedSignedMessageBuffer!.equals(messageBytes)).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    }),
  );

  it.effect('omits value and does not warn on Err(UndefinedError)', () =>
    Effect.gen(function* () {
      const feedId = 'FEED_Y';
      const timestamp = 2n;
      const feed: FeedResult = { Err: { UndefinedError: {} } };

      const feedIdBytes = Buffer.from(feedId);
      const timestampBuf = Buffer.allocUnsafe(16);
      timestampBuf.writeBigUInt64BE(timestamp, 8);
      const messageBytes = Buffer.concat([feedIdBytes, timestampBuf]);

      const sigHex = yield* generateSignature(
        TEST_PRIV_HEX,
        feedId,
        timestamp,
        feed,
      );
      expect(sigHex).toBe('0xstub');
      expect(signMock).toHaveBeenCalledTimes(1);
      expect(capturedSignedMessageBuffer!.equals(messageBytes)).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    }),
  );
});
