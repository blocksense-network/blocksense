/**
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

/**
 * Pauses execution for a specified duration.
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified duration.
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a function repeatedly while a given condition is true.
 *
 * @param cond A function that takes the result of the repeated function as an argument and returns a boolean value.
 * @param f The function to execute repeatedly.
 * @param time The amount of time to wait between each execution of the function (in ms).
 * @param maxAttempts Optional maximum number of attempts before throwing an error. Default is 100.
 * @return The final result of the repeated function.
 */
export async function loopWhile<T>(
  cond: (r: T) => boolean,
  f: () => Promise<T>,
  time: number,
  maxAttempts: number = 100,
): Promise<T> {
  let attempts = 0;
  let result = await f();
  attempts++;

  while (cond(result)) {
    if (maxAttempts !== undefined && attempts >= maxAttempts) {
      throw new Error(`loopWhile: Reached maxAttempts (${maxAttempts})`);
    }

    await sleep(time);
    result = await f();
    attempts++;
  }

  return result;
}

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

/**
 * Checks whether all elements in an array satisfy an asynchronous predicate.
 *
 * @template T The type of the elements in the input array.
 *
 * @param {T[]} array - The array to check.
 * @param {(entry: T) => Promise<boolean>} asyncPredicate - The asynchronous predicate function to apply to each element of the array.
 *
 * @returns {Promise<boolean>} A promise that resolves to `true` if all elements satisfy the async predicate, otherwise `false`.
 */
export async function everyAsync<T>(
  array: T[],
  asyncPredicate: (entry: T) => Promise<boolean>,
): Promise<boolean> {
  const boolArray = await Promise.all(array.map(asyncPredicate));
  return boolArray.every(b => b);
}

/**
 * Executes an asynchronous function and applies a timeout.
 * If the provided asynchronous function (`asyncFn`) does not resolve or reject
 * within the `timeoutMillis` duration, the returned Promise will reject
 * with the `timeoutError`.
 *
 * @template T - The type of the value that the `asyncFn` promise resolves to.
 * @param asyncFn - A function that returns a Promise. This is the asynchronous
 *                  operation to be executed with a timeout.
 * @param timeoutMillis - The maximum time in milliseconds to wait for `asyncFn`
 *                        to complete.
 * @param timeoutError - (Optional) The error to be thrown if the operation
 *                       times out. Defaults to an `Error` instance indicating
 *                       that the operation timed out after `timeoutMillis` ms.
 * @returns A Promise that resolves with the result of `asyncFn` if it completes
 *          within the timeout period. It rejects with `timeoutError` if the
 *          timeout is reached, or with any error thrown by `asyncFn` itself
 *          if `asyncFn` rejects before the timeout.
 */
export async function withTimeout<T>(
  asyncFn: () => Promise<T>,
  timeoutMillis: number,
  timeoutError = new Error(`Operation timed out after ${timeoutMillis} ms`),
): Promise<T> {
  const { promise, reject } = Promise.withResolvers<T>();

  const timeoutId = setTimeout(() => reject(timeoutError), timeoutMillis);

  try {
    return await Promise.race([asyncFn(), promise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
