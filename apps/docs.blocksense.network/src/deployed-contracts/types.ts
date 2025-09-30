import { Schema as S } from 'effect';

import type { NetworkName } from '@blocksense/base-utils/evm';
import { ethereumAddress, networkName } from '@blocksense/base-utils/evm';

const CoreContractSchema = S.mutable(
  S.Struct({
    contract: S.String,
    address: ethereumAddress,
  }),
);

export type CoreContract = typeof CoreContractSchema.Type;

const CoreContractsPerNetworkSchema = S.mutable(
  S.Struct({
    contracts: S.mutable(S.Array(CoreContractSchema)),
    network: networkName,
  }),
);

export type CoreContractsPerNetwork = typeof CoreContractsPerNetworkSchema.Type;

export type CoreContractsDataAndNetworks = {
  contracts: Array<CoreContractsPerNetwork | undefined>;
  networks: NetworkName[];
};

const ProxyContractDataSchema = S.mutable(
  S.Struct({
    name: S.String,
    id: S.String,
    network: networkName,
    base: S.NullishOr(ethereumAddress),
    quote: S.NullishOr(ethereumAddress),
    address: ethereumAddress,
  }),
);

export type ProxyContractData = typeof ProxyContractDataSchema.Type;
