import React from 'react';

import { StructDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variable } from '@/sol-contracts-components/Variable';

type StructsProps = {
  structs?: StructDocItem[];
};

export const Structs = ({ structs }: StructsProps) => {
  return (
    <ContractItemWrapper title="## Structs" itemsLength={structs?.length}>
      {structs?.map((struct, index) => (
        <div key={index}>
          <h3>{struct.name}</h3>
          <span>Visibility: {struct.visibility}</span>
          {struct?._members?.map((structMember, index) => (
            <Variable key={index} variable={structMember} />
          ))}
          <NatSpec natspec={struct.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
