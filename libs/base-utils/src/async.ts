/**
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

/**
 * Filters an array based on an asynchronous predicate.
 *
 * @template T The type of the elements in the input array.
 *
 * @param {T[]} array - The array to filter.
 * @param {(entry: T) => Promise<boolean>} asyncPredicate - The asynchronous predicate function to apply to each element of the array.
 *
 * @returns {Promise<T[]>} A promise that resolves to a new array that includes only the elements for which the async predicate returned `true`.
 */
export async function filterAsync<T>(
  array: T[],
  asyncPredicate: (entry: T) => Promise<boolean>,
): Promise<T[]> {
  const boolArray = await Promise.all(array.map(asyncPredicate));
  return array.filter((_, i) => boolArray[i]);
}
