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
    <div className="core-contract-card container w-full px-0 m-0 mt-6">
      <Card className="core-contract-card__container container w-full shadow-sm rounded-none">
        <CardHeader className="core-contract-card__header mb-0">
          <CardTitle className="core-contract-card__title">
            <h3 className="text-xl core-contract-card__name border border-solid border-neutral-200 rounded-sm text-md px-2 py-1 bg-zinc-50 font-semibold text-gray-900">
              {contract.name}
            </h3>
          </CardTitle>
        </CardHeader>
        <CardContent className="core-contract-card__content">
          <h6 className="core-contract-card__address-label text-sm text-gray-950 flex justify-between">
            Address:
          </h6>
          <div className="core-contract-card__address-container flex items-center space-x-2">
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
