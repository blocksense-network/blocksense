import { FetchHttpClient, HttpClientRequest } from '@effect/platform';
import { NodeHttpClient } from '@effect/platform-node';
import { HttpClient } from '@effect/platform/HttpClient';
import { Console, Effect } from 'effect';
import { generateSignature } from './generate-signature';

const POST_REPORTS_BATCH_URL = 'http://127.0.0.1:9856/post_reports_batch';

type ReportData = {
  feed_id: string;
  reporter_id: number;
  signature: string;
  timestamp: string;
};

type RequestBody = Array<{
  payload_metadata: ReportData;
  result: {
    Ok: {
      Numerical: number;
    };
  };
}>;

const request = Effect.gen(function* () {
  const feedId = '100002';
  const value = 1.109616;
  const timestamp = '1755685551079';
  const signature = yield* Effect.tryPromise(() =>
    generateSignature(
      '536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003',
      '100002',
      BigInt(timestamp),
      {
        Ok: true,
        value: {
          kind: 'Numerical',
          value: 1,
        },
      },
    ),
  );
  console.log(`Signature: ${signature}`);

  const body: RequestBody = [
    {
      payload_metadata: {
        feed_id: feedId,
        reporter_id: 0,
        signature,
        timestamp,
      },
      result: {
        Ok: {
          Numerical: value,
        },
      },
    },
  ];

  const client = yield* HttpClient;
  const response = HttpClientRequest.post(POST_REPORTS_BATCH_URL).pipe(
    HttpClientRequest.bodyText(
      JSON.stringify(body),
      'application/json; charset=UTF-8',
    ),
    client.execute,
  );

  return yield* response;
}).pipe(Effect.provide(FetchHttpClient.layer));

const program = request.pipe(
  Effect.tap(Console.log),
  Effect.provide(NodeHttpClient.layer),
  Effect.catchAll(error => Console.error('Request failed', error)),
);

Effect.runPromise(program).catch(console.error);
