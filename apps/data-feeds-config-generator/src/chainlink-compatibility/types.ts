import { BigInt as EFBigInt, ParseResult, Schema as S } from 'effect';

import { ethereumAddress } from '@blocksense/base-utils/evm';

export class NumberFromBigInt extends S.transformOrFail(
  S.Union(S.BigIntFromSelf, S.Number),
  S.Number,
  {
    strict: true,
    encode: (n, _, ast) =>
      ParseResult.fromOption(
        EFBigInt.fromNumber(n),
        () => new ParseResult.Type(ast, n),
      ),
    decode: (b, _, ast) =>
      ParseResult.fromOption(
        EFBigInt.toNumber(BigInt(b)),
        () => new ParseResult.Type(ast, b),
      ),
  },
).annotations({ identifier: 'NumberFromBigInt' }) {}

export const ConfirmedFeedEvent = S.Struct({
  asset: ethereumAddress,
  denomination: ethereumAddress,
  latestAggregator: ethereumAddress,
  previousAggregator: ethereumAddress,
  nextPhaseId: NumberFromBigInt, // uint16 in Solidity
  sender: ethereumAddress,
});

export type ConfirmedFeedEvent = typeof ConfirmedFeedEvent.Type;

export const decodeConfirmedFeedEvent = S.decodeUnknownSync(ConfirmedFeedEvent);

export const FeedRegistryEventsPerAggregatorSchema = S.Record({
  key: ethereumAddress,
  value: ConfirmedFeedEvent,
});

export type FeedRegistryEventsPerAggregator =
  typeof FeedRegistryEventsPerAggregatorSchema.Type;
