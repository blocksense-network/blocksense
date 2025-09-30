import * as React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@blocksense/docs-ui/Table';
import type { VariableDocItem } from '@blocksense/sol-reflector';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type Column =
  | 'type'
  | 'name'
  | 'description'
  | 'indexed'
  | 'mutability'
  | 'dataLocation';

type ParametersProps = {
  parameters?: VariableDocItem[];
  title?: string;
  parentTitle?: string;
  titleLevel?: 5 | 6;
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
      return parameter._natspecDescription || '-';
    case 'mutability':
      return parameter.mutability || '-';
    case 'dataLocation':
      return parameter.storageLocation
        ? parameter.storageLocation === 'default'
          ? 'memory'
          : parameter.storageLocation
        : '-';
    default:
      return '-';
  }
};

export const Parameters = ({
  columns = ['type', 'name', 'description'],
  parameters,
  parentTitle,
  title = 'Parameters',
  titleLevel = 5,
}: ParametersProps) => {
  return (
    <ContractItemWrapper
      nonEmpty={!!parameters?.length}
      title={title}
      parentTitle={parentTitle}
      titleLevel={titleLevel}
    >
      <Table className="variables__table">
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
          {parameters?.map((parameter, index) => (
            <TableRow className="variables__table-row" key={index}>
              {columns.map(column => (
                <TableCell
                  className={`variables__table-cell variables__table-cell--${column}`}
                  key={column}
                >
                  {column === 'description' ? (
                    getParameterValueByColumn(parameter, column)
                  ) : (
                    <code>{getParameterValueByColumn(parameter, column)}</code>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
