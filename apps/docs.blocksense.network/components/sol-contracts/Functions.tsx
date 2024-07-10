import React from 'react';
import { Badge } from '@/components/ui/badge';

import { FunctionDocItem } from '@blocksense/sol-reflector';

import { Signature } from '@/sol-contracts-components/Signature';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from './AnchorLinkTitle';

type FunctionsProps = {
  functions?: FunctionDocItem[];
  isFromSourceUnit?: boolean;
};

export const Functions = ({ functions, isFromSourceUnit }: FunctionsProps) => {
  return (
    <ContractItemWrapper
      title="Functions"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={functions?.length}
    >
      {functions?.map((_function, index) => (
        <div className="contract-item-wrapper__function space-y-4" key={index}>
          <AnchorLinkTitle
            title={_function.name}
            titleLevel={isFromSourceUnit ? 3 : 4}
          />
          <Selector selector={_function.functionSelector} />
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
          <Variables
            variables={_function._parameters}
            title="Parameters"
            titleLevel={4}
          />
          <Variables
            variables={_function._returnParameters}
            title="Return Parameters"
            titleLevel={4}
          />
          <FunctionModifiers functionModifiers={_function._modifiers} />
          <NatSpec natspec={_function.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
