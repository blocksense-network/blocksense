import React from 'react';
import { Badge } from '@/components/ui/badge';

import { Signature } from '@/sol-contracts-components/Signature';
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
    <ContractItemWrapper title="Functions" itemsLength={functions?.length}>
      {functions?.map((_function, index) => (
        <div key={index} className="space-y-4">
          {_function.name && (
            <Badge variant="accentary">{_function.name}</Badge>
          )}
          <Badge>
            <span>Kind: {_function.kind}</span>
          </Badge>
          {_function.functionSelector && (
            <Badge variant="secondary">
              <span>Selector: {_function.functionSelector}</span>
            </Badge>
          )}
          <Signature signature={_function.signature} />
          <Badge>
            <span>Visibility: {_function.visibility}</span>
          </Badge>
          <Badge>
            <span>State Mutability: {_function.stateMutability}</span>
          </Badge>
          <Badge>
            <span>Virtual: {_function.virtual.toString()}</span>
          </Badge>
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
