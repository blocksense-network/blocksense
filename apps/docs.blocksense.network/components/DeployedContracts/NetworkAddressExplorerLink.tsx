import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
  getAddressExplorerUrl,
  NetworkName,
  EthereumAddress,
} from '@blocksense/base-utils/evm';
import { DataTableBadge } from '@/components/ui/DataTable/DataTableBadge';
import { onLinkClick } from '@/src/utils';

type NetworkAddressExplorerLinkProps = {
  address: EthereumAddress;
  networks: NetworkName[];
};

export const NetworkAddressExplorerLink = ({
  address,
  networks,
}: NetworkAddressExplorerLinkProps) => {
  const router = useRouter();

  return (
    <aside className="space-y-1">
      {networks.map((network: NetworkName) => (
        <DataTableBadge key={network}>
          <Link
            onClick={e =>
              onLinkClick(
                e,
                router,
                getAddressExplorerUrl(network, address),
                true,
              )
            }
            onAuxClick={e =>
              onLinkClick(
                e,
                router,
                getAddressExplorerUrl(network, address),
                true,
              )
            }
            href={getAddressExplorerUrl(network, address)}
          >
            {network}
          </Link>
        </DataTableBadge>
      ))}
    </aside>
  );
};
