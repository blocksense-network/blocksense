import { DataFeedStoreBaseWrapper } from './basic/Base';
import { DataFeedStoreV1Wrapper } from './basic/V1';
import { DataFeedStoreV2Wrapper } from './basic/V2';
import { DataFeedStoreV3Wrapper } from './basic/V3';

import { DataFeedStoreGenericV1Wrapper } from './basic/GenericV1';
import { DataFeedStoreGenericV2Wrapper } from './basic/GenericV2';

import { HistoricalDataFeedStoreBaseWrapper } from './historical/Base';
import { HistoricalDataFeedStoreWrapper } from './historical/WrapperBase';
import { HistoricalDataFeedStoreV1Wrapper } from './historical/V1';
import { HistoricalDataFeedStoreV2Wrapper } from './historical/V2';

import { HistoricalDataFeedStoreGenericBaseWrapper } from './historical/WrapperGenericBase';
import { HistoricalDataFeedStoreGenericV1Wrapper } from './historical/GenericV1';

import { DataFeedStoreConsumerBaseWrapper } from './consumers/Base';
import { DataFeedStoreConsumerV1Wrapper } from './consumers/V1';
import { DataFeedStoreConsumerV2Wrapper } from './consumers/V2';
import { DataFeedStoreConsumerV3Wrapper } from './consumers/V3';
import { DataFeedStoreGenericConsumerV1Wrapper } from './consumers/GenericV1';
import { DataFeedStoreGenericConsumerV2Wrapper } from './consumers/GenericV2';

import { HistoricalDataFeedStoreConsumerBaseWrapper } from './consumers/historical/Base';
import { HistoricalDataFeedStoreConsumerV1Wrapper } from './consumers/historical/V1';
import { HistoricalDataFeedStoreConsumerV2Wrapper } from './consumers/historical/V2';
import { HistoricalDataFeedStoreGenericConsumerV1Wrapper } from './consumers/historical/GenericV1';

import { UpgradeableProxyBaseWrapper } from './upgradeable/Base';
import { UpgradeableProxyDataFeedStoreV1Wrapper } from './upgradeable/V1';
import { UpgradeableProxyDataFeedStoreV2Wrapper } from './upgradeable/V2';
import { UpgradeableProxyDataFeedStoreV3Wrapper } from './upgradeable/V3';
import { UpgradeableProxyDataFeedStoreV1GenericWrapper } from './upgradeable/GenericV1';
import { UpgradeableProxyDataFeedStoreV2GenericWrapper } from './upgradeable/GenericV2';
import { UpgradeableProxyHistoricalBaseWrapper } from './upgradeable/historical/Base';
import { UpgradeableProxyHistoricalDataFeedStoreV1Wrapper } from './upgradeable/historical/V1';
import { UpgradeableProxyHistoricalDataFeedStoreV2Wrapper } from './upgradeable/historical/V2';
import { UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper } from './upgradeable/historical/GenericV1';

import { CLBaseWrapper } from './chainlink/Base';
import { CLV1Wrapper } from './chainlink/V1';
import { CLV2Wrapper } from './chainlink/V2';

import { CLRegistryBaseWrapper } from './chainlink/registry/Base';

import { IBaseWrapper } from './interfaces/IBaseWrapper';
import { ISetWrapper } from './interfaces/ISetWrapper';
import { IConsumerWrapper } from './interfaces/IConsumerWrapper';
import { IHistoricalConsumerWrapper } from './interfaces/IHistoricalConsumerWrapper';
import { IHistoricalWrapper } from './interfaces/IHistoricalWrapper';

export {
  DataFeedStoreBaseWrapper,
  DataFeedStoreV1Wrapper,
  DataFeedStoreV2Wrapper,
  DataFeedStoreV3Wrapper,
  DataFeedStoreGenericV1Wrapper,
  DataFeedStoreGenericV2Wrapper,

  // historical
  HistoricalDataFeedStoreBaseWrapper,
  HistoricalDataFeedStoreWrapper,
  HistoricalDataFeedStoreV1Wrapper,
  HistoricalDataFeedStoreV2Wrapper,
  HistoricalDataFeedStoreGenericBaseWrapper,
  HistoricalDataFeedStoreGenericV1Wrapper,

  // consumers
  DataFeedStoreConsumerBaseWrapper,
  DataFeedStoreConsumerV1Wrapper,
  DataFeedStoreConsumerV2Wrapper,
  DataFeedStoreConsumerV3Wrapper,
  DataFeedStoreGenericConsumerV1Wrapper,
  DataFeedStoreGenericConsumerV2Wrapper,

  // historical consumers
  HistoricalDataFeedStoreConsumerBaseWrapper,
  HistoricalDataFeedStoreConsumerV1Wrapper,
  HistoricalDataFeedStoreConsumerV2Wrapper,
  HistoricalDataFeedStoreGenericConsumerV1Wrapper,

  // upgradable proxy
  UpgradeableProxyBaseWrapper,
  UpgradeableProxyDataFeedStoreV1Wrapper,
  UpgradeableProxyDataFeedStoreV2Wrapper,
  UpgradeableProxyDataFeedStoreV3Wrapper,
  UpgradeableProxyDataFeedStoreV1GenericWrapper,
  UpgradeableProxyDataFeedStoreV2GenericWrapper,

  // upgradable historical proxy
  UpgradeableProxyHistoricalBaseWrapper,
  UpgradeableProxyHistoricalDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreV2Wrapper,
  UpgradeableProxyHistoricalDataFeedStoreGenericV1Wrapper,

  // chainlink aggregator
  CLBaseWrapper,
  CLV1Wrapper,
  CLV2Wrapper,

  // chainlink registry
  CLRegistryBaseWrapper,

  // interfaces
};

export type {
  IBaseWrapper,
  ISetWrapper as IWrapper,
  IConsumerWrapper,
  IHistoricalConsumerWrapper,
  IHistoricalWrapper,
};
