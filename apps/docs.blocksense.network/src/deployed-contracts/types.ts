import { Schema as S } from 'effect';

import { ethereumAddress, networkName } from '@blocksense/base-utils/evm';
import { DeploymentConfigSchemaV2 } from '@blocksense/config-types';

const CoreContractSchema = S.mutable(
  S.Struct({
    contract: S.String,
    address: ethereumAddress,
    networks: S.mutable(S.Array(networkName)),
  }),
);

export type CoreContract = typeof CoreContractSchema.Type;

export const decodeCoreContract = S.decodeUnknownSync(CoreContractSchema);

export const decodeCoreContracts = S.decodeUnknownSync(
  S.mutable(S.Array(CoreContractSchema)),
);

const ProxyContractDataSchema = S.mutable(
  S.Struct({
    description: S.String,
    feedId: S.String,
    network: networkName,
    base: S.NullishOr(ethereumAddress),
    quote: S.NullishOr(ethereumAddress),
    address: ethereumAddress,
  }),
);

export type ProxyContractData = typeof ProxyContractDataSchema.Type;

export const decodeProxyContractData = S.decodeUnknownSync(
  ProxyContractDataSchema,
);

export const decodeProxyContracts = S.decodeUnknownSync(
  S.mutable(S.Array(ProxyContractDataSchema)),
);

export const DeploymentConfigArraySchema = S.mutable(
  S.Array(DeploymentConfigSchemaV2),
);

export type DeploymentConfigArray = typeof DeploymentConfigArraySchema.Type;

export const decodeDeploymentConfigArray = S.decodeUnknownSync(
  DeploymentConfigArraySchema,
);
