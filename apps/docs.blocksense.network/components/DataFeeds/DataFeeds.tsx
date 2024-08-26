import * as React from 'react';

import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { DataTable } from '@/components/ui/DataTable/DataTable';
import { columns } from '@/components/DataFeeds/columns';

type ParametersProps = {
  dataFeedsOverviewString: string;
};

export const DataFeeds = ({ dataFeedsOverviewString }: ParametersProps) => {
  const feeds = JSON.parse(dataFeedsOverviewString);

  return (
    <ContractItemWrapper
      title="Data Feeds"
      titleLevel={2}
      itemsLength={feeds.length}
    >
      <DataTable columns={columns} data={feeds} filterCell={'description'} />
    </ContractItemWrapper>
  );
};
