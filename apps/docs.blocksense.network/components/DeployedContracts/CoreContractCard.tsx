import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';

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
  return (
    <div className="w-full flex justify-center">
      <Card className="w-full max-w-3xl sm:px-4">
        <CardHeader>
          <span>
            <CardTitle className="flex justify-between items-center pt-2">
              <span>{contract.name}</span>
            </CardTitle>
          </span>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2">Address:</h3>
          <div className="flex items-center space-x-2">
            <ContractAddress
              address={contract.address}
              network={contract.networks[0]}
              enableCopy
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
