import * as React from 'react';
import { Badge } from '@/components/ui/badge';

import { VariableDocItem } from '@blocksense/sol-reflector';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { AnchorLinkTitle } from './AnchorLinkTitle';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

export const Variables = ({ variables, title, titleLevel }: VariablesProps) => {
  return (
    <ContractItemWrapper
      itemsLength={variables?.length}
      title={title}
      titleLevel={titleLevel}
    >
      {variables?.map((variable, index) => (
        <section
          className="contract-item-wrapper__variable space-y-4"
          key={index}
        >
          <AnchorLinkTitle
            title={variable.name ? variable.name : 'unnamed'}
            titleLevel={4}
          />
          <Badge className="contract-item-wrapper__variable-mutability">
            <span>Mutability: {variable.mutability}</span>
          </Badge>
          <Signature signature={variable.signature} />
          <NatSpec natspec={variable.natspec} />
        </section>
      ))}
    </ContractItemWrapper>
  );
};
