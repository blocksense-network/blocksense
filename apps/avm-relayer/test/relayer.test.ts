import { beforeAll, describe, expect, test, assert } from '@effect/vitest';
import * as S from 'effect/Schema';
import {
  createPXEClient,
  waitForPXE,
  type AccountWallet,
  type PXE,
} from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';

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
