import * as S from '@effect/schema/Schema';

import { ethereumAddress } from '@blocksense/base-utils/evm-utils';

const ConstructorArgsSchema = S.Array(S.Union(S.String, S.Number));

const ContractSchema = S.Struct({
  address: ethereumAddress,
  constructorArgs: ConstructorArgsSchema,
});

const CoreContractsSchema = S.Struct({
  HistoricDataFeedStoreV2: ContractSchema,
  UpgradeableProxy: ContractSchema,
  FeedRegistry: ContractSchema,
});

const ChainlinkProxySchema = S.Struct({
  description: S.String,
  address: ethereumAddress,
  base: S.NullishOr(ethereumAddress),
  quote: S.NullishOr(ethereumAddress),
  constructorArgs: ConstructorArgsSchema,
});

const ContractsSchema = S.Struct({
  coreContracts: CoreContractsSchema,
  ChainlinkProxy: S.Array(ChainlinkProxySchema),
  SafeMultisig: ethereumAddress,
});

const PerNetworkSchema = S.Struct({
  name: S.String,
  contracts: ContractsSchema,
});

const DeploymentConfigSchema = S.Record({
  key: S.String,
  value: PerNetworkSchema,
});

export type DeploymentConfig = S.Schema.Type<typeof DeploymentConfigSchema>;

export const decodeDeploymentConfig = S.decodeUnknownSync(
  DeploymentConfigSchema,
);
