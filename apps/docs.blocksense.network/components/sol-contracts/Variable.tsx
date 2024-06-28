import React from 'react';

import { VariableDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';

type VariableProps = {
  variable: VariableDocItem;
};

export const Variable = ({ variable }: VariableProps) => {
  return (
    <div>
      <span>{variable.name || '-'}</span>
      <span>Type Identifier: {variable.typeDescriptions.typeIdentifier}</span>
      <span>Type String: {variable.typeDescriptions.typeString}</span>
      {variable.signature && <span>Signature: {variable.signature}</span>}
      <span>Mutability: {variable.mutability}</span>
      {variable._value && <span>Value: {variable._value}</span>}
      <span>Indexed: {variable.indexed.toString()}</span>
      <span>Constant: {variable.constant.toString()}</span>
      <NatSpec natspec={variable.natspec} />
    </div>
  );
};
