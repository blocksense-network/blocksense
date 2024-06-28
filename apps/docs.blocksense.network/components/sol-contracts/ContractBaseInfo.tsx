import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <div>
      <h2>{contract.name}</h2>
      <span>Kind: {contract.contractKind}</span>
      <span>Abstract: {contract.abstract.toString()}</span>
      <NatSpec natspec={contract.natspec} />
      {contract._baseContracts.length > 0 && (
        <div>
          <h4>Base Contracts</h4>
          <ul>
            {contract._baseContracts.map(baseContract => (
              <li key={baseContract}>{baseContract}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
