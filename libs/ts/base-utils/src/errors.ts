/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

export type ToJsonResult = { message: string; cause?: string };

export class BaseError extends Error {
  toJSON(): ToJsonResult {
    const res: ToJsonResult = {
      message: this.message,
    };

    if (this.cause) {
      res.cause =
        this.cause instanceof Error
          ? this.cause.message
          : JSON.stringify(this.cause);
    }

    return res;
  }
}

/**
 * Throws an error with the specified message.
 *
 * @param message - The error message.
 * @throws Always throws an `Error` with the specified message.
 * @returns This function never returns as it always throws an error.
 */
export function throwError(message: string): never {
  throw new Error(message);
}
