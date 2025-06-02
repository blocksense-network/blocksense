import {
  Effect as E,
  Schema as S,
  ParseResult,
  BigInt as EFBigInt,
} from 'effect';

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

/**
 * @description
 * A higher-order schema transformation that creates a schema for comma-separated values.
 *
 * It takes a base schema `s` which knows how to decode/encode a single element (`T`)
 * from/to a `string`.
 *
 * The returned schema transforms between a single comma-separated `string` and a
 * `ReadonlyArray<T>`.
 *
 * @param s - The schema `Schema<T, string>` for individual elements.
 * @returns A new schema `Schema<ReadonlyArray<T>, string>` that handles comma-separated strings.
 *
 * @example
 * import { Schema as S } from "effect";
 * import { pipe } from "effect/Function";
 *
 * // Define a schema for numbers that can be parsed from strings
 * const NumberFromString = S.NumberFromString;
 *
 * // Create the comma-separated schema
 * const CommaSeparatedNumbers = fromCommaSeparatedString(NumberFromString);
 *
 * // Decode
 * const decode = S.decodeUnknownSync(CommaSeparatedNumbers);
 * console.log(decode("1,2,3"));      // Output: [1, 2, 3]
 * console.log(decode(""));           // Output: []
 * console.log(decode(" 1 , 2 ,3 ")); // Output: [1, 2, 3] (if NumberFromString handles trimming)
 *
 * try {
 *   decode("1,abc,3");
 * } catch (e) {
 *   console.error("Decode failed:", e); // Catches ParseError
 * }
 *
 * // Encode
 * const encode = S.encodeSync(CommaSeparatedNumbers);
 * console.log(encode([4, 5, 6]));    // Output: "4,5,6"
 * console.log(encode([]));          // Output: ""
 */
export const fromCommaSeparatedString = <T, S extends string>(
  itemSchema: S.Schema<T, S>,
): S.Schema<ReadonlyArray<T>, string> =>
  S.transformOrFail(
    // from: string
    S.String,
    // to: ReadonlyArray<T>
    S.Array(S.typeSchema(itemSchema)),
    // how:
    {
      strict: true,

      decode: (s: string, options, ast) => {
        const trimmed = s.trim();
        if (trimmed === '') {
          return ParseResult.succeed([] as ReadonlyArray<T>);
        }
        const parts = trimmed.split(',').map(part => part.trim());

        return S.decodeUnknown(S.Array(itemSchema))(parts, options).pipe(
          E.mapError(parseError => parseError.issue),
        );
      },

      encode: (items: ReadonlyArray<T>, options) => {
        // Encode the array of T back into an array of strings using itemSchema's encoder
        return S.encode(S.Array(itemSchema))(items, options).pipe(
          // Then join the encoded strings with a comma
          E.map(encodedParts => encodedParts.join(',')),
          E.mapError(parseError => parseError.issue),
        );
      },
    },
  );
