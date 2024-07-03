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
        <CardTitle>### {contract.name}</CardTitle>
        <CardDescription>
          <aside className="p-4 contract-details">
            <section className="flex space-x-4 contract-details__content">
              <section className="flex-shrink-0 contract-details__item">
                <section className="flex items-center">
                  <dt className="text-sm text-gray-600 contract-details__label">
                    Kind:
                  </dt>
                  <dd className="ml-2 font-semibold text-black contract-details__value">
                    {contract.contractKind}
                  </dd>
                </section>
              </section>
              <section className="flex-shrink-0 contract-details__item">
                <section className="flex items-center">
                  <dt className="text-sm text-gray-600 contract-details__label">
                    Abstract:
                  </dt>
                  <dd className="ml-2 font-semibold text-black contract-details__value">
                    {contract.abstract.toString()}
                  </dd>
                </section>
              </section>
            </section>
          </aside>
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
