import bls from '@chainsafe/bls';
import { Effect, Schema as S } from 'effect';

export const ReportPayloadDataSchema = S.Struct({
  feed_id: S.String,
  reporter_id: S.Number,
  timestamp: S.Number,
  signature: S.String,
});

export const FeedTypeSchema = S.Union(
  S.Struct({ Numerical: S.Number }),
  S.Struct({ Text: S.String }),
  S.Struct({ Bytes: S.Array(S.Number) }),
);

export const FeedErrorSchema = S.Union(
  S.Struct({ APIError: S.String }),
  S.Struct({ UndefinedError: S.Struct({}) }),
);

export const FeedResultSchema = S.Union(
  S.Struct({ Ok: FeedTypeSchema }),
  S.Struct({ Err: FeedErrorSchema }),
);

export const DataFeedPayloadSchema = S.Struct({
  payload_metadata: ReportPayloadDataSchema,
  result: FeedResultSchema,
});

export type PayloadMetaData = typeof ReportPayloadDataSchema.Type;
export type FeedType = typeof FeedTypeSchema.Type;
export type FeedError = typeof FeedErrorSchema.Type;
export type FeedResult = typeof FeedResultSchema.Type;
export type DataFeedPayload = typeof DataFeedPayloadSchema.Type;

const u128ToBytes = (value: bigint): Effect.Effect<Buffer, never> =>
  Effect.sync(() => {
    const buf = Buffer.alloc(16);

    const hi = value >> 64n;
    const lo = value & ((1n << 64n) - 1n);

    buf.writeBigUInt64BE(hi, 0);
    buf.writeBigUInt64BE(lo, 8);

    return buf;
  });

// TODO: (danielstoyanov): Implement proper encoding for floating point number, Text and Bytes
const feedTypeToBytes = (
  feed: FeedType,
  timestamp: bigint,
): Effect.Effect<Buffer, Error> =>
  Effect.sync(() => {
    const tsBuf = Buffer.allocUnsafe(8);
    tsBuf.writeBigUInt64BE(timestamp, 0);

    if ('Numerical' in feed) {
      const scaled = BigInt(Math.trunc(feed.Numerical * 1e18));

      const hi = scaled >> 64n;
      const lo = scaled & ((1n << 64n) - 1n);

      const buf = Buffer.alloc(24);
      buf.writeBigUInt64BE(hi, 0);
      buf.writeBigUInt64BE(lo, 16);

      return Buffer.concat([buf, tsBuf]);
    }

    if ('Text' in feed) {
      const textBuf = new TextEncoder().encode(feed.Text);
      return Buffer.concat([textBuf, tsBuf]);
    }
    if ('Bytes' in feed) {
      const bytes = feed.Bytes;
      const bytesBuf = Buffer.isBuffer(bytes)
        ? bytes
        : Buffer.from(Uint8Array.from(bytes));
      return Buffer.concat([bytesBuf, tsBuf]);
    }

    return Buffer.from([]);
  });

export const generateSignature = (
  privKeyHex: string,
  feedId: string,
  timestamp: bigint,
  feedResult: FeedResult,
): Effect.Effect<string, Error, never> =>
  Effect.gen(function* () {
    const feedIdBytes = Buffer.from(feedId);
    const tsBytes = yield* u128ToBytes(timestamp);

    let byteBuffer = Buffer.concat([feedIdBytes, tsBytes]);

    if ('Ok' in feedResult) {
      const valueBytes = yield* feedTypeToBytes(feedResult.Ok, timestamp);
      byteBuffer = Buffer.concat([byteBuffer, valueBytes]);
    } else {
      const err = feedResult.Err;
      const msg = 'APIError' in err ? err.APIError : 'UndefinedError';
      console.warn(`Error parsing received result of vote: ${msg}`);
    }

    const secretKey = bls.SecretKey.fromHex(privKeyHex);
    const sig = secretKey.sign(byteBuffer);
    return sig.toHex();
  });
