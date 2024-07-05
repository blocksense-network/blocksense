import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { NatSpec } from '@/sol-contracts-components/NatSpec';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{contract.name}</CardTitle>
        <CardDescription>
          <span className="text-sm text-gray-600 contract-details__label">
            Kind: {contract.contractKind}
          </span>
          <span className="text-sm text-gray-600 contract-details__label">
            Abstract: {contract.abstract.toString()}
          </span>
        </CardDescription>
      </CardHeader>
      {contract._baseContracts.length > 0 && (
        <CardContent>
          <div>
            <span className="text-sm text-muted-foreground">
              Base Contracts
            </span>
            <ul className="ml-6 list-disc">
              {contract._baseContracts.map(baseContract => (
                <li key={baseContract}>{baseContract}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
      <CardFooter>
        <NatSpec natspec={contract.natspec} />
      </CardFooter>
    </Card>
  );
};
