import * as S from 'effect/Schema';

import { ethereumAddress } from '@blocksense/base-utils/evm';

export const safeContractName = S.Literal(
  'SimulateTxAccessor',
  'SafeProxyFactory',
  'TokenCallbackHandler',
  'CompatibilityFallbackHandler',
  'CreateCall',
  'MultiSend',
  'MultiSendCallOnly',
  'SignMessageLib',
  'SafeToL2Setup',
  'Safe',
  'SafeL2',
  'SafeToL2Migration',
  'SafeMigration',
);
export type SafeContractName = typeof safeContractName.Type;

export const safeContracts = S.Record({
  key: safeContractName,
  value: ethereumAddress,
});
