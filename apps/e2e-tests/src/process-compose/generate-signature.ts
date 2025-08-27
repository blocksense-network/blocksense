import { Effect, Schema as S } from 'effect';
import bls from '@chainsafe/bls';

import { pow10, bigIntToBytesBE, truncate } from '../utils/utilities';

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

function asBytes(
  feed: FeedType,
  timestamp: bigint,
  digitsInFraction: number,
): Effect.Effect<Buffer, Error> {
  const timestampBuf = Buffer.allocUnsafe(8);
  timestampBuf.writeBigUInt64BE(timestamp, 0);

  if ('Numerical' in feed) {
    const [integerPart, fractionalPart] = String(feed.Numerical).split('.');
    const integer = BigInt(integerPart);

    let actualDigitsInFraction: number;
    let fraction: bigint;
    if (fractionalPart) {
      const truncated = truncate(fractionalPart.toString(), 18);
      actualDigitsInFraction = truncated.length;
      fraction = BigInt(truncated || '0');
    } else {
      actualDigitsInFraction = 0;
      fraction = 0n;
    }
    const result =
      integer * pow10(digitsInFraction) +
      fraction * pow10(digitsInFraction - actualDigitsInFraction);

    let valueBytes = bigIntToBytesBE(result);

    if (valueBytes.length > 32) {
      valueBytes = valueBytes.slice(valueBytes.length - 32);
    }

    let bytesBuffer = Buffer.alloc(32);
    bytesBuffer.set(valueBytes, 32 - valueBytes.length);
    bytesBuffer = Buffer.from(bytesBuffer.slice(8));

    return Effect.succeed(Buffer.concat([bytesBuffer, timestampBuf]));
  } else if ('Text' in feed) {
    return Effect.succeed(Buffer.from(feed.Text));
  } else if ('Bytes' in feed) {
    return Effect.succeed(Buffer.from(feed.Bytes));
  }

  return Effect.fail(new Error('Invalid feed result type!'));
}

export const generateSignature = (
  privKeyHex: string,
  feedId: string,
  timestamp: bigint,
  feedResult: FeedResult,
): Effect.Effect<string, Error, never> =>
  Effect.gen(function* () {
    const feedIdBytes = Buffer.from(feedId);

    const timestampBuf = Buffer.allocUnsafe(16);
    timestampBuf.writeBigUInt64BE(timestamp, 8);

    let byteBuffer = Buffer.concat([feedIdBytes, timestampBuf]);

    if ('Ok' in feedResult) {
      const valueBytes = yield* asBytes(feedResult.Ok, timestamp, 18);
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
