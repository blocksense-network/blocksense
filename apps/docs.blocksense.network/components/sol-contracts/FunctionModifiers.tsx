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
} from '@blocksense/docs-ui/Table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type FunctionModifiersProps = {
  functionModifiers?: FunctionModifierDocItem[];
};

export const FunctionModifiers = ({
  functionModifiers,
}: FunctionModifiersProps) => {
  return (
    <ContractItemWrapper
      title="Function Modifiers"
      titleLevel={4}
      nonEmpty={!!functionModifiers?.length}
    >
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
          {functionModifiers?.length &&
            functionModifiers?.map((functionModifier, index) => (
              <TableRow
                className="contract-item-wrapper__table-row"
                key={index}
              >
                <TableCell className="contract-item-wrapper__table-cell">
                  <code>{functionModifier._modifierName}</code>
                </TableCell>
                <TableCell className="contract-item-wrapper__table-cell">
                  <code>{functionModifier.kind}</code>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
