import * as S from '@effect/schema/Schema';

import { ethereumAddress, networkName } from '@blocksense/base-utils/evm-utils';

const CoreContractSchema = S.mutable(
  S.Struct({
    contract: S.String,
    address: ethereumAddress,
    networks: S.mutable(S.Array(networkName)),
  }),
);

export type CoreContract = S.Schema.Type<typeof CoreContractSchema>;

export const decodeCoreContract = S.decodeUnknownSync(CoreContractSchema);

export const decodeCoreContracts = S.decodeUnknownSync(
  S.mutable(S.Array(CoreContractSchema)),
);
