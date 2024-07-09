import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { ErrorDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';

type ErrorsProps = {
  errors?: ErrorDocItem[];
};

export const Errors = ({ errors }: ErrorsProps) => {
  return (
    <ContractItemWrapper title="Errors" itemsLength={errors?.length}>
      {errors?.map((error, index) => (
        <div className="contract-item-wrapper__error" key={index}>
          <h3 className="contract-item-wrapper__error-title">
            {error.name} <Selector selector={error.errorSelector} />
          </h3>
          <Signature signature={error.signature} />
          <Variables variables={error?._parameters} title="Parameters" />
          <NatSpec natspec={error.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
