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
    <ContractItemWrapper
      className="contract-item-wrapper"
      title="Contracts"
      itemsLength={contracts?.length}
    >
      {contracts?.map((contract, index) => {
        return (
          <div className="contract-item-wrapper__item" key={index}>
            <ContractBaseInfo className="contract-base-info" {...contract} />
            <Functions
              className="contract__functions"
              functions={contract.functions}
            />
            <Errors className="contract__errors" errors={contract.errors} />
            <Events className="contract__events" events={contract.events} />
            <Modifiers
              className="contract__modifiers"
              modifiers={contract.modifiers}
            />
            <Variables
              className="contract__variables"
              variables={contract.variables}
              title="Variables"
            />
            <Enums className="contract__enums" enums={contract.enums} />
            <Structs className="contract__structs" structs={contract.structs} />
          </div>
        );
      })}
    </ContractItemWrapper>
  );
};
