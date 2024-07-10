import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';

import { NatSpec } from '@/sol-contracts-components/NatSpec';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <div className="contract-base-info bg-gray-50 py-3 lg:px-6  mt-6 flex items-start space-y-4">
      <Card className="contract-base-info__card w-full bg-white shadow-md rounded-lg mt-4 mb-4 py-3 px-3">
        <CardHeader className="contract-base-info__header">
          <CardDescription className="contract-base-info__description bg-gray-50 rounded-lg font-bold px-3 py-2 flex items-center">
            <span className="contract-base-info__kind text-base text-black">
              Kind: {contract.contractKind}
            </span>
            <span className="contract-base-info__abstract__abstract ml-4 text-base text-black">
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
              <NatSpec natspec={contract.natspec} />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};
