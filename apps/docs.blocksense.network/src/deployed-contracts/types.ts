import { Schema as S } from 'effect';

import {
  ethereumAddress,
  NetworkName,
  networkName,
} from '@blocksense/base-utils/evm';

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
  contracts: (CoreContractsPerNetwork | undefined)[];
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
