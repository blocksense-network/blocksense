import { Schema as S, ParseResult, BigInt as EFBigInt } from 'effect';

export class NumberFromSelfBigIntOrString extends S.transformOrFail(
  S.Union(S.BigIntFromSelf, S.Number, S.NumberFromString),
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
).annotations({ identifier: 'NumberFromSelfBigIntOrString' }) {}
