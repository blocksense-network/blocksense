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

type Column =
  | 'type'
  | 'name'
  | 'description'
  | 'indexed'
  | 'mutability'
  | 'dataLocation';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  columns?: Column[];
};

const columnNames = {
  type: 'Type',
  name: 'Name',
  indexed: 'Indexed',
  description: 'Description',
  mutability: 'Mutability',
  dataLocation: 'Data Location',
};

const getParameterValueByColumn = (
  parameter: VariableDocItem,
  column: string,
) => {
  switch (column) {
    case 'type':
      return parameter.typeDescriptions.typeString;
    case 'name':
      return parameter.name || parameter._natspecName || 'unnamed';
    case 'indexed':
      return parameter.indexed ? 'Yes' : 'No';
    case 'description':
      return parameter.natspec.dev || parameter.natspec.notice || '-';
    case 'mutability':
      return parameter.mutability || '-';
    // case 'dataLocation':
    //   return parameter.dataLocation || '-';
    default:
      return '-';
  }
};

export const Variables = ({
  variables = [],
  title,
  titleLevel,
  columns = ['type', 'name', 'description'],
}: VariablesProps) => {
  return (
    <ContractItemWrapper
      itemsLength={variables?.length}
      title={title}
      titleLevel={titleLevel}
    >
      <Table className="variables__table mt-6 mb-4">
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            {columns.map(column => (
              <TableHead className="variables__table-head" key={column}>
                {columnNames[column]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {variables?.map((variable, index) => (
            <TableRow className="variables__table-row" key={index}>
              {columns.map(column => (
                <TableCell
                  className={`variables__table-cell variables__table-cell--${column}`}
                  key={column}
                >
                  {getParameterValueByColumn(variable, column)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
