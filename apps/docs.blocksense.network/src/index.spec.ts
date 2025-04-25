import { describe, expect, test } from 'vitest';

import { info } from './index';

describe('Test', () => {
  test('test', () => {
    expect(info).toEqual('Blocksense Documentation Website');
  });
});
