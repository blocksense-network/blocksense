/**
 * SPDX-FileCopyrightText: Copyright (c) 2023 Blockdaemon Inc.
 * SPDX-FileCopyrightText: Copyright (c) 2024 Schelling Point Labs Inc.
 *
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, test } from 'vitest';

import { throwError } from './errors';

describe('`errors` tests', () => {
  test(`'throwError' should throw an error with the specified message`, () => {
    const errorMessage = 'Something went wrong';
    expect(() => throwError(errorMessage)).toThrow(Error);
    expect(() => throwError(errorMessage)).toThrow(errorMessage);
  });
});
