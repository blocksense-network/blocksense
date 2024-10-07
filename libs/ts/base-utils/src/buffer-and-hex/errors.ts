/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { BaseError } from '../errors';

/**
 * Error thrown when the argument is not in hex string format.
 */
export class ExpectedHexStringError extends BaseError {
  constructor(actual: string, minByteLength: number | 'quantity' = 0) {
    if (minByteLength === 'quantity') {
      super(
        `Expected quantity in hex string format (0x123...). Got: '${actual}'`,
      );
    } else {
      super(
        `Expected argument in hex string format (0xab12...) with byte length >= ${minByteLength}. Got: '${actual}'`,
      );
    }
    this.name = 'ExpectedHexStringError';
  }
}
