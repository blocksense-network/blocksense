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
    <div className="bg-gray-50 p-2 lg:p-6 mt-6 flex items-start space-y-4">
      <Card className="w-[350px] bg-white shadow-md rounded-lg py-3 px-3">
        <CardHeader>
          <CardTitle className="text-2xl font-bold mb-4">
            {contract.name}
          </CardTitle>
          <CardDescription className="mb-6 bg-gray-50 rounded-lg text-black font-bold px-3 py-2 flex items-center">
            <span className="contract__kind mr-4">
              Kind: {contract.contractKind}
            </span>
            <span className="contract__abstract ml-4">
              Abstract: {contract.abstract.toString()}
            </span>
          </CardDescription>
        </CardHeader>

        {contract._baseContracts.length > 0 && (
          <CardContent>
            <div>
              <span className="text-xl font-semibold text-gray-800 ml-4">
                Base Contracts
              </span>
              <ul className="ml-6 mt-2 list-disc list-inside text-gray-700">
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
    </div>
  );
};
