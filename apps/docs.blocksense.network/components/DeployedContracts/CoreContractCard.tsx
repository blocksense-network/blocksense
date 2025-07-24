import { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@blocksense/docs-ui/Card';
import { ContractAddress } from '@/components/sol-contracts/ContractAddress';

type CoreContractProps = {
  name: string;
  address: EthereumAddress;
  network: NetworkName;
};

export const CoreContractCard = ({
  contract,
}: {
  contract: CoreContractProps;
}) => {
  return (
    <div className="w-full flex justify-center -mt-4 mb-0">
      <Card className="w-full max-w-3xl justify-items-center sm:px-2">
        <CardHeader className="pb-0">
          <CardTitle className="flex justify-center items-center pt-1">
            <span className="text-left">{contract.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-4">
          <div className="w-full">
            <h3 className="font-semibold mb-1 justify-center">Address:</h3>
            <div className="flex items-center space-x-2">
              <ContractAddress
                address={contract.address}
                network={contract.network}
                copyButton={{ enableCopy: true, background: false }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
