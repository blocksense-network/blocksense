import React from 'react';

import { StructDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

type StructsProps = {
  structs?: StructDocItem[];
};

export const Structs = ({ structs }: StructsProps) => {
  return (
    <ContractItemWrapper title="Structs" itemsLength={structs?.length}>
      {structs?.map((struct, index) => (
        <div className="contract-item-wrapper__struct" key={index}>
          <h3 className="contract-item-wrapper__struct-title">{struct.name}</h3>
          <span className="contract-item-wrapper__struct-visibility">
            Visibility: {struct.visibility}
          </span>
          <Variables
            className="contract-item-wrapper__struct-members"
            variables={struct?._members}
            title="Members"
          />
          <NatSpec
            className="contract-item-wrapper__struct-natspec"
            natspec={struct.natspec}
          />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
