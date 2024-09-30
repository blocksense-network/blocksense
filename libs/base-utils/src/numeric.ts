import * as bigInt_ from 'effect/BigInt';
import * as ParseResult from '@effect/schema/ParseResult';
import * as S from '@effect/schema/Schema';

export class NumberFromSelfBigIntOrString extends S.transformOrFail(
  S.Union(S.BigIntFromSelf, S.Number, S.NumberFromString),
  S.Number,
  {
    strict: true,
    encode: (n, _, ast) =>
      ParseResult.fromOption(
        bigInt_.fromNumber(n),
        () => new ParseResult.Type(ast, n),
      ),
    decode: (b, _, ast) =>
      ParseResult.fromOption(
        bigInt_.toNumber(BigInt(b)),
        () => new ParseResult.Type(ast, b),
      ),
  },
).annotations({ identifier: 'NumberFromSelfBigIntOrString' }) {}
