import React from 'react';

import { ModifierDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variable } from '@/sol-contracts-components/Variable';

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
          {modifier?._parameters?.map((modifierParameter, index) => (
            <Variable key={index} variable={modifierParameter} />
          ))}
          <NatSpec natspec={modifier.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
