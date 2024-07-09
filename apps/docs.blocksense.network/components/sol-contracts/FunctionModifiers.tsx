import React from 'react';

import { FunctionModifierDocItem } from '@blocksense/sol-reflector';

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

type FunctionModifiersProps = {
  functionModifiers?: FunctionModifierDocItem[];
};

export const FunctionModifiers = ({
  functionModifiers,
}: FunctionModifiersProps) => {
  return (
    <ContractItemWrapper itemsLength={functionModifiers?.length}>
      <Table className="contract-item-wrapper__table-component">
        <TableCaption className="contract-item-wrapper__table-caption">
          Function Modifiers
        </TableCaption>
        <TableHeader className="contract-item-wrapper__table-header">
          <TableRow className="contract-item-wrapper__table-row">
            <TableHead className="contract-item-wrapper__table-head">
              Modifier Name
            </TableHead>
            <TableHead className="contract-item-wrapper__table-head">
              Kind
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="contract-item-wrapper__table-body">
          {functionModifiers?.map((functionModifier, index) => (
            <TableRow className="contract-item-wrapper__table-row" key={index}>
              <TableCell className="contract-item-wrapper__table-cell">
                {functionModifier._modifierName}
              </TableCell>
              <TableCell className="contract-item-wrapper__table-cell">
                {functionModifier.kind}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
