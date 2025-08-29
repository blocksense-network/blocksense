import { HttpClientRequest } from '@effect/platform';
import { NodeHttpClient } from '@effect/platform-node';
import { HttpClient } from '@effect/platform/HttpClient';
import { Clock, Console, Effect } from 'effect';
import type { FeedResult } from './generate-signature';
import { generateSignature } from './generate-signature';
import { skip0x } from '@blocksense/base-utils/buffer-and-hex';
import type { HttpClientResponse } from '@effect/platform/HttpClientResponse';
import type { HttpClientError } from '@effect/platform/HttpClientError';

const postReportsBatchUrl = 'http://127.0.0.1:9856/post_reports_batch';

type ReportData = {
  feed_id: string;
  value: number | string | Buffer;
};

type ReportPayloadData = {
  feed_id: string;
  reporter_id: number;
  timestamp: number;
  signature: string;
};

type ReportPayload = {
  payload_metadata: ReportPayloadData;
  result: FeedResult;
};

export const postReportsBatch = (
  reports: Array<ReportData>,
): Effect.Effect<HttpClientResponse, HttpClientError | Error, never> =>
  Effect.gen(function* () {
    const reporterKey =
      '536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003';
    const timestamp = yield* Clock.currentTimeMillis;

    const x = { Ok: { Bytes: [72, 101, 108, 108, 111] } };

    const reportsPayload: Array<ReportPayload> = yield* Effect.forEach(
      reports,
      r =>
        Effect.gen(function* () {
          const signature = yield* generateSignature(
            reporterKey,
            r.feed_id,
            BigInt(timestamp),
            x,
          ).pipe(
            Effect.mapError(
              err => new Error(`Failed to generate signature: ${err}`),
            ),
          );
          console.log('SIG: ', signature);
          return {
            payload_metadata: {
              feed_id: r.feed_id,
              reporter_id: 0,
              signature: skip0x(signature),
              timestamp,
            },
            result: x,
          };
        }),
    );

    const client = yield* HttpClient;
    const response = HttpClientRequest.post(postReportsBatchUrl).pipe(
      HttpClientRequest.bodyText(
        JSON.stringify(reportsPayload),
        'application/json; charset=UTF-8',
      ),
      client.execute,
    );

    return yield* response;
  }).pipe(Effect.provide(NodeHttpClient.layer));

const feed_id = '32';
const value = 'some text';
const reports: Array<ReportData> = [{ feed_id, value }];
postReportsBatch(reports).pipe(Effect.tap(Console.log), Effect.runPromise); //

// Ok → Numerical
const numericalResult: FeedResult = { Ok: { Numerical: 3.14159 } };

// Ok → Text
const textResult: FeedResult = { Ok: { Text: 'sensor online' } };

// Ok → Bytes
const bytesResult: FeedResult = { Ok: { Bytes: [72, 101, 108, 108, 111] } };

// Err → APIError
const apiErrorResult: FeedResult = { Err: { APIError: 'Rate limit exceeded' } };

// Err → UndefinedError
const undefinedErrorResult: FeedResult = { Err: { UndefinedError: {} } };
