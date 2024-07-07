import React from 'react';

import { VariableDocItem } from '@blocksense/sol-reflector';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
};

export const Variables = ({ variables, title }: VariablesProps) => {
  return (
    <ContractItemWrapper
      className="contract-item-wrapper"
      itemsLength={variables?.length}
    >
      <Table className="variables__table">
        <TableCaption className="variables__caption">{title}</TableCaption>
        <TableHeader className="variables__table-header">
          <TableRow className="variables__header-row">
            <TableHead className="variables__header">Name</TableHead>
            <TableHead className="variables__header">Type Identifier</TableHead>
            <TableHead className="variables__header">Type String</TableHead>
            <TableHead className="variables__header">Signature</TableHead>
            <TableHead className="variables__header">Mutability</TableHead>
            <TableHead className="variables__header">Value</TableHead>
            <TableHead className="variables__header">Indexed</TableHead>
            <TableHead className="variables__header">Constant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="variables__body">
          {variables?.map((variable, index) => (
            <TableRow className="variables__row" key={index}>
              <TableCell className="variables__cell">{variable.name}</TableCell>
              <TableCell className="variables__cell">
                {variable.typeDescriptions.typeIdentifier}
              </TableCell>
              <TableCell className="variables__cell">
                {variable.typeDescriptions.typeString}
              </TableCell>
              <TableCell className="variables__cell">
                {variable.signature}
              </TableCell>
              <TableCell className="variables__cell">
                {variable.mutability}
              </TableCell>
              <TableCell className="variables__cell">
                {variable._value}
              </TableCell>
              <TableCell className="variables__cell">
                {variable.indexed.toString()}
              </TableCell>
              <TableCell className="variables__cell">
                {variable.constant.toString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
