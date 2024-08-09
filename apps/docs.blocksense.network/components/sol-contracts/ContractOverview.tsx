import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { getOverviewCodeContent } from '@/src/contract-overview';
import { OverviewCodeBlock } from '../common/CodeBlock';

type ContractOverviewProps = {
  contract: ContractDocItem;
};

export const ContractOverview = ({ contract }: ContractOverviewProps) => {
  return <OverviewCodeBlock code={getOverviewCodeContent(contract)} />;
};
