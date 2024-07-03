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
    <ContractItemWrapper itemsLength={variables?.length}>
      <Table>
        <TableCaption>{title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type Identifier</TableHead>
            <TableHead>Type String</TableHead>
            <TableHead>Signature</TableHead>
            <TableHead>Mutability</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Indexed</TableHead>
            <TableHead>Constant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables?.map((variable, index) => (
            <TableRow key={index}>
              <TableCell>{variable.name}</TableCell>
              <TableCell>{variable.typeDescriptions.typeIdentifier}</TableCell>
              <TableCell>{variable.typeDescriptions.typeString}</TableCell>
              <TableCell>{variable.signature}</TableCell>
              <TableCell>{variable.mutability}</TableCell>
              <TableCell>{variable._value}</TableCell>
              <TableCell>{variable.indexed.toString()}</TableCell>
              <TableCell>{variable.constant.toString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
