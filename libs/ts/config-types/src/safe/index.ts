import * as S from 'effect/Schema';

import { InverseOf } from '@blocksense/base-utils/type-level';

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

export const safeContractNameMapping = {
  MultiSend: 'multiSendAddress',
  MultiSendCallOnly: 'multiSendCallOnlyAddress',
  CreateCall: 'createCallAddress',
  Safe: 'safeSingletonAddress',
  SafeProxyFactory: 'safeProxyFactoryAddress',
  CompatibilityFallbackHandler: 'fallbackHandlerAddress',
  SignMessageLib: 'signMessageLibAddress',
  SimulateTxAccessor: 'simulateTxAccessorAddress',
} satisfies Partial<Record<SafeContractName, string>>;

export type SafeContracts = InverseOf<typeof safeContractNameMapping>;
