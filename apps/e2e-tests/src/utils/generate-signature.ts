import { Effect, Schema as S } from 'effect';
import bls from '@chainsafe/bls';

import { powerOf10BigInt, bigIntToBytesBE, truncate } from './utilities';

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

const isNumericalFeed = (feed: FeedType): feed is { Numerical: number } =>
  'Numerical' in feed;
const isTextFeed = (feed: FeedType): feed is { Text: string } => 'Text' in feed;
const isBytesFeed = (feed: FeedType): feed is { Bytes: number[] } =>
  'Bytes' in feed;

const isOkResult = (result: FeedResult): result is { Ok: FeedType } =>
  'Ok' in result;
const isErrResult = (result: FeedResult): result is { Err: FeedError } =>
  'Err' in result;

export function asBytes(
  feed: FeedType,
  timestamp: bigint,
  digitsInFraction: number,
): Effect.Effect<Buffer, Error> {
  const timestampBuf = Buffer.allocUnsafe(8);
  timestampBuf.writeBigUInt64BE(timestamp, 0);

  if (isNumericalFeed(feed)) {
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
      integer * powerOf10BigInt(digitsInFraction) +
      fraction * powerOf10BigInt(digitsInFraction - actualDigitsInFraction);

    let valueBytes = bigIntToBytesBE(result);

    if (valueBytes.length > 32) {
      valueBytes = valueBytes.slice(valueBytes.length - 32);
    }

    let bytesBuffer = Buffer.alloc(32);
    bytesBuffer.set(valueBytes, 32 - valueBytes.length);
    bytesBuffer = Buffer.from(bytesBuffer.slice(8));

    return Effect.succeed(Buffer.concat([bytesBuffer, timestampBuf]));
  } else if (isTextFeed(feed)) {
    return Effect.succeed(Buffer.from(feed.Text));
  } else if (isBytesFeed(feed)) {
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

    if (isOkResult(feedResult)) {
      const valueBytes = yield* asBytes(feedResult.Ok, timestamp, 18);
      byteBuffer = Buffer.concat([byteBuffer, valueBytes]);
    } else if (isErrResult(feedResult)) {
      const err = feedResult.Err;
      const msg = 'APIError' in err ? err.APIError : 'UndefinedError';
      console.warn(`Error parsing received result of vote: ${msg}`);
    }

    const secretKey = bls.SecretKey.fromHex(privKeyHex);
    const sig = secretKey.sign(byteBuffer);
    return sig.toHex();
  });
