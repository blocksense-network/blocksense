import { beforeAll, describe, expect, test } from '@effect/vitest';
import type { AccountWallet, PXE } from '@aztec/aztec.js';

let pxe: PXE;
let _wallets: Array<AccountWallet> = [];

beforeAll(async () => {

  pxe = setupSandbox()

});

describe('AVM Relayer', () => {
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
