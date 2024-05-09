import { DataFeedStoreBaseWrapper } from './basic/Base';
import { DataFeedStoreV1Wrapper } from './basic/V1';
import { DataFeedStoreV2Wrapper } from './basic/V2';
import { DataFeedStoreV3Wrapper } from './basic/V3';

import { DataFeedStoreGenericV1Wrapper } from './basic/GenericV1';
import { DataFeedStoreGenericV2Wrapper } from './basic/GenericV2';

import { HistoricDataFeedStoreBaseWrapper } from './historic/Base';
import { HistoricDataFeedStoreWrapper } from './historic/WrapperBase';
import { HistoricDataFeedStoreV1Wrapper } from './historic/V1';
import { HistoricDataFeedStoreV2Wrapper } from './historic/V2';

import { HistoricDataFeedStoreGenericBaseWrapper } from './historic/WrapperGenericBase';
import { HistoricDataFeedStoreGenericV1Wrapper } from './historic/GenericV1';

import { DataFeedStoreConsumerBaseWrapper } from './consumers/Base';
import { DataFeedStoreConsumerV1Wrapper } from './consumers/V1';
import { DataFeedStoreConsumerV2Wrapper } from './consumers/V2';
import { DataFeedStoreConsumerV3Wrapper } from './consumers/V3';
import { DataFeedStoreGenericConsumerV1Wrapper } from './consumers/GenericV1';
import { DataFeedStoreGenericConsumerV2Wrapper } from './consumers/GenericV2';

import { HistoricDataFeedStoreConsumerBaseWrapper } from './consumers/historic/Base';
import { HistoricDataFeedStoreConsumerV1Wrapper } from './consumers/historic/V1';
import { HistoricDataFeedStoreConsumerV2Wrapper } from './consumers/historic/V2';
import { HistoricDataFeedStoreGenericConsumerV1Wrapper } from './consumers/historic/GenericV1';

import { UpgradeableProxyBaseWrapper } from './upgradable/Base';
import { UpgradeableProxyDataFeedStoreV1Wrapper } from './upgradable/V1';
import { UpgradeableProxyDataFeedStoreV2Wrapper } from './upgradable/V2';
import { UpgradeableProxyDataFeedStoreV3Wrapper } from './upgradable/V3';
import { UpgradeableProxyDataFeedStoreV1GenericWrapper } from './upgradable/GenericV1';
import { UpgradeableProxyDataFeedStoreV2GenericWrapper } from './upgradable/GenericV2';
import { UpgradeableProxyHistoricBaseWrapper } from './upgradable/historic/Base';
import { UpgradeableProxyHistoricDataFeedStoreV1Wrapper } from './upgradable/historic/V1';
import { UpgradeableProxyHistoricDataFeedStoreV2Wrapper } from './upgradable/historic/V2';
import { UpgradeableProxyHistoricDataFeedStoreGenericV1Wrapper } from './upgradable/historic/GenericV1';

import { IBaseWrapper } from './interfaces/IBaseWrapper';
import { ISetWrapper } from './interfaces/ISetWrapper';
import { IConsumerWrapper } from './interfaces/IConsumerWrapper';
import { IHistoricConsumerWrapper } from './interfaces/IHistoricConsumerWrapper';
import { IHistoricWrapper } from './interfaces/IHistoricWrapper';

export {
  DataFeedStoreBaseWrapper,
  DataFeedStoreV1Wrapper,
  DataFeedStoreV2Wrapper,
  DataFeedStoreV3Wrapper,
  DataFeedStoreGenericV1Wrapper,
  DataFeedStoreGenericV2Wrapper,

  // historic
  HistoricDataFeedStoreBaseWrapper,
  HistoricDataFeedStoreWrapper,
  HistoricDataFeedStoreV1Wrapper,
  HistoricDataFeedStoreV2Wrapper,
  HistoricDataFeedStoreGenericBaseWrapper,
  HistoricDataFeedStoreGenericV1Wrapper,

  // consumers
  DataFeedStoreConsumerBaseWrapper,
  DataFeedStoreConsumerV1Wrapper,
  DataFeedStoreConsumerV2Wrapper,
  DataFeedStoreConsumerV3Wrapper,
  DataFeedStoreGenericConsumerV1Wrapper,
  DataFeedStoreGenericConsumerV2Wrapper,

  // historic consumers
  HistoricDataFeedStoreConsumerBaseWrapper,
  HistoricDataFeedStoreConsumerV1Wrapper,
  HistoricDataFeedStoreConsumerV2Wrapper,
  HistoricDataFeedStoreGenericConsumerV1Wrapper,

  // upgradable proxy
  UpgradeableProxyBaseWrapper,
  UpgradeableProxyDataFeedStoreV1Wrapper,
  UpgradeableProxyDataFeedStoreV2Wrapper,
  UpgradeableProxyDataFeedStoreV3Wrapper,
  UpgradeableProxyDataFeedStoreV1GenericWrapper,
  UpgradeableProxyDataFeedStoreV2GenericWrapper,

  // upgradable historic proxy
  UpgradeableProxyHistoricBaseWrapper,
  UpgradeableProxyHistoricDataFeedStoreV1Wrapper,
  UpgradeableProxyHistoricDataFeedStoreV2Wrapper,
  UpgradeableProxyHistoricDataFeedStoreGenericV1Wrapper,

  // interfaces
  IBaseWrapper,
  ISetWrapper as IWrapper,
  IConsumerWrapper,
  IHistoricConsumerWrapper,
  IHistoricWrapper,
};
