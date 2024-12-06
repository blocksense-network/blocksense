import React from 'react';
import { ContractAnchorLink } from '@/sol-contracts-components/ContractAnchorLink';

export const Overview = () => {
  return (
    <ul className="overview__list nx-mt-6 nx-list-none first:nx-mt-0 ltr:nx-ml-0 rtl:nx-mr-6">
      <ContractAnchorLink label="ProxyCall" />
      <ContractAnchorLink label="IChainlinkFeedRegistry" />
      <ContractAnchorLink label="IChainlinkAggregator" />
      <ContractAnchorLink label="IFeedRegistry" />
      <ContractAnchorLink label="IAggregator" />
      <ContractAnchorLink label="FeedRegistry" />
      <ContractAnchorLink label="ChainlinkProxy" />
      <ContractAnchorLink label="UpgradeableProxy" />
      <ContractAnchorLink label="HistoricDataFeedStoreV2" />
      <ContractAnchorLink label="HistoricDataFeedStoreV1" />
      <ContractAnchorLink label="DataFeedStoreV3" />
      <ContractAnchorLink label="DataFeedStoreV2" />
      <ContractAnchorLink label="DataFeedStoreV1" />
    </ul>
  );
};
