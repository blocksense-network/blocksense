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
      <Table>
        <TableCaption>Function Modifiers</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Modifier Name</TableHead>
            <TableHead>Kind</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {functionModifiers?.map((functionModifier, index) => (
            <TableRow key={index}>
              <TableCell>{functionModifier._modifierName}</TableCell>
              <TableCell>{functionModifier.kind}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
