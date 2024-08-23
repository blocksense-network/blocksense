import * as React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

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
      <Table className="variables__table mt-6 mb-4">
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            {[
              'Id',
              'Description',
              'Decimals',
              'Refresh Interval (ms)',
              'Data Sources',
            ].map(column => (
              <TableHead className="variables__table-head" key={column}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {feeds.map((feed: any) => (
            <TableRow className="variables__table-row" key={feed.id}>
              <TableCell>{feed.id}</TableCell>
              <TableCell>{feed.description}</TableCell>
              <TableCell>{feed.decimals}</TableCell>
              <TableCell>{feed.report_interval_ms}</TableCell>
              <TableCell>{feed.script}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
