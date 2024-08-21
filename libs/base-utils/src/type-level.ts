/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

export type PrimitiveType = boolean | number | string | symbol | bigint;

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
