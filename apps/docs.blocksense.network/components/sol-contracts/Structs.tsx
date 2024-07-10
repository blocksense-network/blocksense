import React from 'react';

import { StructDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type StructsProps = {
  structs?: StructDocItem[];
  isFromSourceUnit?: boolean;
};

export const Structs = ({ structs, isFromSourceUnit }: StructsProps) => {
  return (
    <ContractItemWrapper
      title="Structs"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={structs?.length}
    >
      {structs?.map((struct, index) => (
        <div className="contract-item-wrapper__struct" key={index}>
          <AnchorLinkTitle
            title={struct.name}
            titleLevel={isFromSourceUnit ? 3 : 4}
          />
          <span className="contract-item-wrapper__struct-visibility">
            Visibility: {struct.visibility}
          </span>
          <Variables
            variables={struct?._members}
            title="Members"
            titleLevel={4}
          />
          <NatSpec natspec={struct.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
