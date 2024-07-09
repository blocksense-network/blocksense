import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { ModifierDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

type ModifiersProps = {
  modifiers?: ModifierDocItem[];
};

export const Modifiers = ({ modifiers }: ModifiersProps) => {
  return (
    <ContractItemWrapper title="Modifiers" itemsLength={modifiers?.length}>
      {modifiers?.map((modifier, index) => (
        <div className="contract-item-wrapper__modifier" key={index}>
          <h3 className="contract-item-wrapper__modifier-title">
            {modifier.name}
          </h3>
          <span className="contract-item-wrapper__modifier-visibility">
            Visibility: {modifier.visibility}
          </span>
          <Signature signature={modifier.signature} />
          <Variables
            key={index}
            variables={modifier?._parameters}
            title="Parameters"
          />
          <NatSpec natspec={modifier.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
