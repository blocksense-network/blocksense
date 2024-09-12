import * as React from 'react';

import { DataTable } from '@/components/ui/DataTable/DataTable';
import {
  contractsColumnsTitles,
  columns,
} from '@/components/DeployedContracts/columns';
import { ContractItemWrapper } from '@/components/sol-contracts/ContractItemWrapper';
import { decodeCoreContracts } from '@/src/deployed-contracts/types';

type DeployedContractsProps = {
  deployedCoreContractsString: string;
};

export const DeployedContracts = ({
  deployedCoreContractsString,
}: DeployedContractsProps) => {
  const deployedContracts = decodeCoreContracts(
    JSON.parse(deployedCoreContractsString),
  );

  return (
    <ContractItemWrapper
      title="Deployed Contracts"
      titleLevel={2}
      itemsLength={deployedContracts.length}
    >
      <DataTable
        columns={columns}
        data={deployedContracts}
        filterCell="network"
        columnsTitles={contractsColumnsTitles}
      />
    </ContractItemWrapper>
  );
};
