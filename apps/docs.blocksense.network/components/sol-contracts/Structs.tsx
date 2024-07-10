import React from 'react';

import { StructDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

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
          <h3 className="contract-item-wrapper__struct-title">{struct.name}</h3>
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
