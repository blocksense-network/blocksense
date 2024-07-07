import React from 'react';
import { Badge } from '@/components/ui/badge';

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
    <div className="contract-base-info bg-gray-50 p-2 lg:p-6 mt-6 flex items-start space-y-4">
      <Card className="contract-base-info__card w-[350px] bg-white shadow-md rounded-lg py-3 px-3">
        <CardHeader className="contract-base-info__header">
          <CardTitle className="contract-base-info__title text-2xl font-bold mb-4">
            {contract.name}
          </CardTitle>
          <CardDescription className="contract-base-info__description mb-6 bg-gray-50 rounded-lg text-black font-bold px-3 py-2 flex items-center">
            <span className="contract-base-info__kind mr-4">
              Kind: {contract.contractKind}
            </span>
            <span className="contract-base-info__abstract__abstract ml-4">
              Abstract: {contract.abstract.toString()}
            </span>
          </CardDescription>
        </CardHeader>

        {contract._baseContracts.length > 0 && (
          <CardContent className="contract-base-info__content">
            <div className="contract-base-info__base-contracts">
              <span className="contract-base-info__base-contracts-title text-xl font-semibold text-gray-800 ml-4">
                Base Contracts
              </span>
              <ul className="contract-base-info__base-contracts-list ml-6 mt-2 list-disc list-inside text-gray-700">
                {contract._baseContracts.map(baseContract => (
                  <li
                    className="contract-base-info__base-contracts-item"
                    key={baseContract}
                  >
                    {baseContract}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}

        <CardFooter className="contract-base-info__footer">
          <NatSpec
            className="contract-item-wrapper__contract-natspec"
            natspec={contract.natspec}
          />
        </CardFooter>
      </Card>
    </div>
  );
};
