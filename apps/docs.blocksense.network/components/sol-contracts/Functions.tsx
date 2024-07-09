import React from 'react';
import { Badge } from '@/components/ui/badge';

import { FunctionDocItem } from '@blocksense/sol-reflector';

import { Signature } from '@/sol-contracts-components/Signature';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';

type FunctionsProps = {
  functions?: FunctionDocItem[];
};

export const Functions = ({ functions }: FunctionsProps) => {
  return (
    <ContractItemWrapper title="Functions" itemsLength={functions?.length}>
      {functions?.map((_function, index) => (
        <div className="contract-item-wrapper__function space-y-4" key={index}>
          {_function.name && (
            <Badge
              className="contract-item-wrapper__function-name"
              variant="accentary"
            >
              {_function.name}{' '}
              <Selector selector={_function.functionSelector} />
            </Badge>
          )}
          <Badge className="contract-item-wrapper__function-kind">
            <span>Kind: {_function.kind}</span>
          </Badge>
          <Badge className="contract-item-wrapper__function-visibility">
            <span>Visibility: {_function.visibility}</span>
          </Badge>
          <Badge className="contract-item-wrapper__function-state-mutability">
            <span>State Mutability: {_function.stateMutability}</span>
          </Badge>
          <Badge className="contract-item-wrapper__function-virtual">
            <span>Virtual: {_function.virtual.toString()}</span>
          </Badge>
          <Signature signature={_function.signature} />
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
