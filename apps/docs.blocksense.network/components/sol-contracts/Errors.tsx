import React from 'react';

import { ErrorDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

type ErrorsProps = {
  errors?: ErrorDocItem[];
};

export const Errors = ({ errors }: ErrorsProps) => {
  return (
    <ContractItemWrapper title="## Errors" itemsLength={errors?.length}>
      {errors?.map((error, index) => (
        <div key={index}>
          <h3>{error.name}</h3>
          <span>Error Selector: {error.errorSelector}</span>
          {error.signature && <span>Signature{error.signature}</span>}
          <Variables variables={error?._parameters} title="Parameters" />
          <NatSpec natspec={error.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
