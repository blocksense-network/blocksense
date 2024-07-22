import * as React from 'react';

import { VariableDocItem } from '@blocksense/sol-reflector';
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
  parameters?: VariableDocItem[];
  title?: string;
  titleLevel?: 4 | 5;
};

export const Parameters = ({
  parameters,
  title = 'Parameters',
  titleLevel = 4,
}: ParametersProps) => {
  return (
    <ContractItemWrapper
      itemsLength={parameters?.length}
      title={title}
      titleLevel={titleLevel}
    >
      <Table className="variables__table mt-6 mb-4">
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            <TableHead className="variables__table-head">Type</TableHead>
            <TableHead className="variables__table-head">Name</TableHead>
            <TableHead className="variables__table-head">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {parameters?.map((parameter, index) => (
            <TableRow className="variables__table-row" key={index}>
              <TableCell className="variables__table-cell variables__table-cell--type">
                {parameter.typeDescriptions.typeString}
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--name">
                {parameter.name || parameter._natspecName || 'unnamed'}
              </TableCell>
              <TableCell className="variables__table-cell variables__table-cell--description">
                {parameter._natspecDescription || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
