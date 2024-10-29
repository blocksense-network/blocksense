import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';
import { NetworkAddressExplorerLink } from '@/components/DeployedContracts/NetworkAddressExplorerLink';

type CoreContractProps = {
  name: string;
  address: EthereumAddress;
  networks: NetworkName[];
};

export const CoreContractCard = ({
  contract,
}: {
  contract: CoreContractProps;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="w-full flex justify-center cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <Card className="w-full max-w-3xl px-4">
        <CardHeader>
          <CardTitle className="flex justify-between items-center cursor-pointer">
            <span>{contract.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2">Address:</h3>
          <div className="flex items-center space-x2">
            <ContractAddress address={contract.address} enableCopy />
          </div>
          {isExpanded && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Networks:</h3>
              <NetworkAddressExplorerLink
                address={contract.address}
                networks={contract.networks}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
