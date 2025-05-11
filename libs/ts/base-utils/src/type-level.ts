/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

export type PrimitiveType = boolean | number | string | symbol | bigint;
export type LiteralScalar = PrimitiveType | undefined | null;
export type NonEmptyTuple<T> = [T, ...T[]];
export type LiteralTuple = [Literal, ...Literal[]]; // NonEmptyTuple<Literal> does not work :(
export type Literal =
  | LiteralScalar
  | LiteralTuple
  | {
      [key: string]: Literal;
    };

export type KeysOf<T> = Extract<keyof T, string>;
export type ValuesOf<T> = T[KeysOf<T>];
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export type KeyFromValue<V, T extends Record<PropertyKey, PropertyKey>> = {
  [K in KeysOf<T>]: V extends T[K] ? K : never;
}[KeysOf<T>];

/**
 *  Computes the inverse map of an object.
 *  Example: { a: 1, b: 2} => { 1: a, 2: b}
 */
export type InverseOf<T extends Record<PropertyKey, PropertyKey>> = {
  [V in ValuesOf<T>]: KeyFromValue<V, T>;
};

/**
 * Recursively replaces instances of the type `Replace` with `WithThat` in the
 * given type `Where`.
 *
 * @example
 * // The types `x` and `y` below are equivalent:
 * type x = ReplaceType<{ x: { y: { a: [string, null, boolean, number]; }[]; } }, string, number>
 * //                   vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
 * type y =             { x: { y: { a: [number, null, boolean, number]; }[]; } }
 */
export type ReplaceType<Where, Replace, WithWhat> = Where extends Replace
  ? WithWhat
  : Where extends PrimitiveType
    ? Where
    : {
        [K in keyof Where]: ReplaceType<Where[K], Replace, WithWhat>;
      };

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
