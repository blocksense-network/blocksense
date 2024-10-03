import * as React from 'react';
import Link from 'next/link';

import {
  getAddressExplorerUrl,
  NetworkName,
  EthereumAddress,
} from '@blocksense/base-utils/evm';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';

type NetworkAddressExplorerLinkProps = {
  address: EthereumAddress;
  networks: NetworkName[];
};

export const NetworkAddressExplorerLink = ({
  address,
  networks,
}: NetworkAddressExplorerLinkProps) => {
  return (
    <aside className="space-y-1">
      {networks.map((network: NetworkName) => (
        <DataTableBadge key={network}>
          <Link href={getAddressExplorerUrl(network, address)} target="_blank">
            {network}
          </Link>
        </DataTableBadge>
      ))}
    </aside>
  );
};
