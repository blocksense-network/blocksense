import React from 'react';

import { VariableDocItem } from '@blocksense/sol-reflector';

import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variable } from '@/sol-contracts-components/Variable';

type VariablesProps = {
  variables?: VariableDocItem[];
};

export const Variables = ({ variables }: VariablesProps) => {
  return (
    <ContractItemWrapper title="## Variables" itemsLength={variables?.length}>
      {variables?.map((varibale, index) => (
        <Variable key={index} variable={varibale} />
      ))}
    </ContractItemWrapper>
  );
};
