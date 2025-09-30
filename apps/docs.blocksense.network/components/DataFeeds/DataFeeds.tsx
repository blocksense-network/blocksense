import * as React from 'react';

import type { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { DataFeedsTable } from '@/components/DataFeeds/DataFeedsTable';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type DataFeedsProps = {
  feedsType: string;
  feedsConfig: FeedsConfig;
};

export const DataFeeds = ({
  feedsConfig: { feeds },
  feedsType,
}: DataFeedsProps) => {
  return (
    <section className="mt-4">
      <ContractItemWrapper
        title={feedsType}
        titleLevel={2}
        nonEmpty={!!feeds.length}
      >
        <DataFeedsTable feeds={feeds} />
      </ContractItemWrapper>
    </section>
  );
};
