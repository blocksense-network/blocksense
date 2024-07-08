import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { ErrorDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

type ErrorsProps = {
  errors?: ErrorDocItem[];
};

export const Errors = ({ errors }: ErrorsProps) => {
  return (
    <ContractItemWrapper
      className="contract-item-wrapper"
      title="Errors"
      itemsLength={errors?.length}
    >
      {errors?.map((error, index) => (
        <div className="contract-item-wrapper__error" key={index}>
          <h3 className="contract-item-wrapper__error-title">
            {error.name} {error.errorSelector}
          </h3>
          <Signature signature={error.signature} />
          <Variables variables={error?._parameters} title="Parameters" />
          <NatSpec
            className="contract-item-wrapper__error-natspec"
            natspec={error.natspec}
          />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
