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
        <div key={index}>
          <h3>{modifier.name}</h3>
          <span>Visibility: {modifier.visibility}</span>
          {modifier.signature && <span>Signature: {modifier.signature}</span>}
          <Signature signature="Modifier Signature" />
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
