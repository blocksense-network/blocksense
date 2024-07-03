import React from 'react';
import { ContractDocItem } from '@blocksense/sol-reflector';

import { Functions } from '@/sol-contracts-components/Functions';
import { Errors } from '@/sol-contracts-components/Errors';
import { Events } from '@/sol-contracts-components/Events';
import { Modifiers } from '@/sol-contracts-components/Modifiers';
import { Enums } from '@/sol-contracts-components/Enums';
import { Structs } from '@/sol-contracts-components/Structs';
import { Variables } from '@/sol-contracts-components/Variables';
import { ContractBaseInfo } from '@/sol-contracts-components/ContractBaseInfo';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

type ContractsProps = {
  contracts?: ContractDocItem[];
};

export const Contracts = ({ contracts }: ContractsProps) => {
  return (
    <ContractItemWrapper title="## Contracts" itemsLength={contracts?.length}>
      {contracts?.map((contract, index) => {
        return (
          <div key={index}>
            <ContractBaseInfo {...contract} />
            <Functions functions={contract.functions} />
            <Errors errors={contract.errors} />
            <Events events={contract.events} />
            <Modifiers modifiers={contract.modifiers} />
            <Variables variables={contract.variables} title="### Variables" />
            <Enums enums={contract.enums} />
            <Structs structs={contract.structs} />
          </div>
        );
      })}
    </ContractItemWrapper>
  );
};
