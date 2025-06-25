import { beforeAll, describe, expect, test } from '@effect/vitest';
import type { AccountWallet, PXE } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { setupSandbox } from '../src/utils';

let pxe: PXE;
let _wallets: Array<AccountWallet> = [];

beforeAll(async () => {
  pxe = await setupSandbox();

  _wallets = await getInitialTestAccountsWallets(pxe);
});

describe('AVM Relayer', () => {
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
