import { DataFeedStoreBaseWrapper } from './dataFeedStore/Base';
import { DataFeedStoreV1Wrapper } from './dataFeedStore/V1';
import { DataFeedStoreV2Wrapper } from './dataFeedStore/V2';
import { DataFeedStoreV3Wrapper } from './dataFeedStore/V3';

import { DataFeedStoreGenericV1Wrapper } from './dataFeedStore/GenericV1';
import { DataFeedStoreGenericV2Wrapper } from './dataFeedStore/GenericV2';

import { HistoricDataFeedStoreBaseWrapper } from './historicDataFeedStore/Base';
import { HistoricDataFeedStoreWrapper } from './historicDataFeedStore/WrapperBase';
import { HistoricDataFeedStoreV1Wrapper } from './historicDataFeedStore/V1';
import { HistoricDataFeedStoreV2Wrapper } from './historicDataFeedStore/V2';

import { HistoricDataFeedStoreGenericBaseWrapper } from './historicDataFeedStore/WrapperGenericBase';
import { HistoricDataFeedStoreGenericV1Wrapper } from './historicDataFeedStore/GenericV1';

import { DataFeedStoreConsumerBaseWrapper } from './consumers/dataFeedStore/Base';
import { DataFeedStoreConsumerV1Wrapper } from './consumers/dataFeedStore/V1';
import { DataFeedStoreConsumerV2Wrapper } from './consumers/dataFeedStore/V2';
import { DataFeedStoreConsumerV3Wrapper } from './consumers/dataFeedStore/V3';
import { DataFeedStoreGenericConsumerV1Wrapper } from './consumers/dataFeedStore/GenericV1';
import { DataFeedStoreGenericConsumerV2Wrapper } from './consumers/dataFeedStore/GenericV2';

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
};
