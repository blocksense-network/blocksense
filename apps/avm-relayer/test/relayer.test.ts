import * as S from 'effect/Schema';
import { assert, beforeAll, describe, expect, test } from '@effect/vitest';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import {
  type AccountWallet,
  createPXEClient,
  type PXE,
  waitForPXE,
} from '@aztec/aztec.js';

const pxeUrl = S.is(S.URL)(process.env['PXE_URL'])
  ? process.env['PXE_URL']
  : null;

describe.skipIf(!pxeUrl)('AVM Relayer', () => {
  let pxe: PXE;
  let wallets: AccountWallet[] = [];

  beforeAll(async () => {
    assert(pxeUrl, 'PXE_URL must be set for AVM Relayer tests');
    pxe = createPXEClient(pxeUrl);
    await waitForPXE(pxe);
    wallets = await getInitialTestAccountsWallets(pxe);
    console.log(
      `Available wallets: ${wallets.map(w => w.getAddress()).join('\n')}`,
    );
  });

  test('should pass', () => {
    expect(true).toBe(true);
  });
});
