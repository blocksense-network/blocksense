import { describe, expect, test } from 'vitest';

import { getEnvString } from './functions';

describe('getEnvString', () => {
  test('returns the value of an existing environment variable', () => {
    process.env.TEST_VAR = 'test value';
    expect(getEnvString('TEST_VAR')).toBe('test value');
  });

  test('throws an error if the environment variable is not set', () => {
    delete process.env.TEST_VAR;
    expect(() => getEnvString('TEST_VAR')).toThrowError(
      "Env variable 'TEST_VAR' is missing.",
    );
  });
});
