import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { ErrorDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type ErrorsProps = {
  errors?: ErrorDocItem[];
  isFromSourceUnit?: boolean;
};

export const Errors = ({ errors, isFromSourceUnit }: ErrorsProps) => {
  return (
    <ContractItemWrapper
      title="Errors"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={errors?.length}
    >
      {errors?.map((error, index) => (
        <div className="contract-item-wrapper__error" key={index}>
          <AnchorLinkTitle
            title={error.name}
            titleLevel={isFromSourceUnit ? 3 : 4}
          />
          <Selector selector={error.errorSelector} />
          <Signature signature={error.signature} />
          <Variables
            variables={error?._parameters}
            title="Parameters"
            titleLevel={isFromSourceUnit ? 4 : 5}
          />
          <NatSpec natspec={error.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
