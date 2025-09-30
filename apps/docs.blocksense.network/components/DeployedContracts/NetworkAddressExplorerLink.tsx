'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { EthereumAddress, NetworkName } from '@blocksense/base-utils/evm';
import { getAddressExplorerUrl } from '@blocksense/base-utils/evm';
import { DataTableBadge } from '@/components/common/DataTable/DataTableBadge';
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
    <div>
      {networks.map((network: NetworkName) => (
        <DataTableBadge className="mt-1 mr-1" key={network}>
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
    </div>
  );
};
