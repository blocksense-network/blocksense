import React from 'react';

import { EnumDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type EnumsProps = {
  enums?: EnumDocItem[];
};

export const Enums = ({ enums }: EnumsProps) => {
  return (
    <ContractItemWrapper
      className="contract-item-wrapper"
      title="Enums"
      itemsLength={enums?.length}
    >
      {enums?.map((_enum, index) => (
        <div className="contract-item-wrapper__enum" key={index}>
          <h3 className="contract-item-wrapper__enum-title">{_enum.name}</h3>
          {_enum._members?.map((member, index) => (
            <div className="contract-item-wrapper__enum-member" key={index}>
              <span className="contract-item-wrapper__enum-member-name">
                {member}
              </span>
            </div>
          ))}
          <NatSpec
            className="contract-item-wrapper__enum-natspec"
            natspec={_enum.natspec}
          />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
