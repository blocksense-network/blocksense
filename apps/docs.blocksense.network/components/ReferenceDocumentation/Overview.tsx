import React from 'react';
import { ContractAnchorLink } from '@/components/sol-contracts/ContractAnchorLink';

export const Overview = () => {
  return (
    <ul className="overview__list nx-mt-6 nx-list-none first:nx-mt-0 ltr:nx-ml-0 rtl:nx-mr-6">
      <ContractAnchorLink label="Blocksense" />
      <ContractAnchorLink label="AccessControl" />{' '}
      <ContractAnchorLink label="IChainlinkFeedRegistry" />
      <ContractAnchorLink label="IChainlinkAggregator" />
      <ContractAnchorLink label="ICLFeedRegistryAdapter" />
      <ContractAnchorLink label="ICLAggregatorAdapter" />
      <ContractAnchorLink label="CLFeedRegistryAdapter" />
      <ContractAnchorLink label="CLAggregatorAdapter" />
      <ContractAnchorLink label="AggregatedDataFeedStore" />
    </ul>
  );
};
