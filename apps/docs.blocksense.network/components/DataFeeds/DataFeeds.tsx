import * as React from 'react';

import { FeedsConfig } from '@blocksense/config-types/data-feeds-config';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { DataFeedsTable } from '@/components/DataFeeds/DataFeedsTable';

type DataFeedsProps = {
  feedsType: string;
  feedsConfig: FeedsConfig;
};

export const DataFeeds = ({
  feedsType,
  feedsConfig: { feeds },
}: DataFeedsProps) => {
  return (
    <section className="mt-4">
      <ContractItemWrapper
        title={feedsType}
        titleLevel={2}
        itemsLength={feeds.length}
      >
        <DataFeedsTable feeds={feeds} />
      </ContractItemWrapper>
    </section>
  );
};
