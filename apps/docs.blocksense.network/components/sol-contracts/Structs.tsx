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
        <div key={index}>
          <h3>{struct.name}</h3>
          <span>Visibility: {struct.visibility}</span>
          <Variables variables={struct?._members} title="Members" />
          <NatSpec natspec={struct.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
