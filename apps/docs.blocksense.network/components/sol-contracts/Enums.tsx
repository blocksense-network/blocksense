import React from 'react';

import { EnumDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type EnumsProps = {
  enums?: EnumDocItem[];
};

export const Enums = ({ enums }: EnumsProps) => {
  return (
    <ContractItemWrapper title="## Enums" itemsLength={enums?.length}>
      {enums?.map((_enum, index) => (
        <div key={index}>
          <h3>{_enum.name}</h3>
          {_enum._members?.map((member, index) => (
            <div key={index}>
              <span>{member}</span>
            </div>
          ))}
          <NatSpec natspec={_enum.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
