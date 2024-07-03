import React from 'react';

import { FunctionDocItem } from '@blocksense/sol-reflector';

import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from './Variables';

type FunctionsProps = {
  functions?: FunctionDocItem[];
};

export const Functions = ({ functions }: FunctionsProps) => {
  return (
    <ContractItemWrapper title="## Functions" itemsLength={functions?.length}>
      {functions?.map((_function, index) => (
        <div key={index}>
          <h3>{_function.name}</h3>
          <span>Kind: {_function.kind}</span>
          {_function.functionSelector && (
            <span>Selector: {_function.functionSelector}</span>
          )}
          {_function.signature && <span>Signature: {_function.signature}</span>}
          <span>Visibility: {_function.visibility}</span>
          <span>State Mutability: {_function.stateMutability}</span>
          <span>Virtual: {_function.virtual.toString()}</span>
          <Variables variables={_function._parameters} title="Parameters" />
          <Variables
            variables={_function._returnParameters}
            title="Return Parameters"
          />
          <FunctionModifiers functionModifiers={_function._modifiers} />
          <NatSpec natspec={_function.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
