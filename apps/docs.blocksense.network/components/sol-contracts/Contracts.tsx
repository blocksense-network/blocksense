import React from 'react';

import type { ContractDocItem } from '@blocksense/sol-reflector';
import { ContractBaseInfo } from '@/sol-contracts-components/ContractBaseInfo';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Enums } from '@/sol-contracts-components/Enums';
import { Errors } from '@/sol-contracts-components/Errors';
import { Events } from '@/sol-contracts-components/Events';
import { Functions } from '@/sol-contracts-components/Functions';
import { Modifiers } from '@/sol-contracts-components/Modifiers';
import { Structs } from '@/sol-contracts-components/Structs';
import { Variables } from '@/sol-contracts-components/Variables';
import { filterConstants, filterVariables } from '@/src/utils';

type ContractsProps = {
  contracts?: ContractDocItem[];
};

export const Contracts = ({ contracts }: ContractsProps) => {
  return (
    <ContractItemWrapper nonEmpty={!!contracts?.length}>
      {contracts?.map((contract, index) => {
        return (
          <div className="contract-item-wrapper__item" key={index}>
            <ContractBaseInfo {...contract} />
            <Enums enums={contract.enums} />
            <Structs structs={contract.structs} />
            <Variables
              variables={filterConstants(contract.variables)}
              title="Constants"
              titleLevel={3}
            />
            <Variables
              variables={filterVariables(contract.variables)}
              title="Variables"
              titleLevel={3}
            />
            <Errors errors={contract.errors} />
            <Events events={contract.events} />
            <Modifiers modifiers={contract.modifiers} />
            <Functions functions={contract.functions} />
          </div>
        );
      })}
    </ContractItemWrapper>
  );
};
