import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/router';

import { Tooltip } from '@/components/common/Tooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { onLinkClick, previewHexStringOrDefault } from '@/src/utils';
import {
  getAddressExplorerUrl,
  isEthereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { cn } from '@/lib/utils';

type ContractAddressProps = {
  network?: NetworkName;
  address: string;
  enableCopy?: boolean;
  abbreviation?: {
    hasAbbreviation?: boolean;
    bytesToShow?: number;
  };
};

export const ContractAddress = ({
  network,
  address,
  enableCopy,
  abbreviation = { hasAbbreviation: false, bytesToShow: 2 },
}: ContractAddressProps) => {
  const router = useRouter();

  if (!address) {
    return '-';
  }

  if (!isEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const addressToDisplay = abbreviation?.hasAbbreviation
    ? previewHexStringOrDefault(address, '-', abbreviation.bytesToShow)
    : address;

  return (
    <div className={cn(enableCopy && 'flex items-start gap-2')}>
      <Tooltip contentClassName="bg-gray-900 text-white">
        {abbreviation?.hasAbbreviation && (
          <Tooltip.Content>{address}</Tooltip.Content>
        )}
        {network ? (
          <code className="hover:underline">
            <Link
              className=""
              href={getAddressExplorerUrl(network, address)}
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
            >
              {addressToDisplay}
            </Link>
          </code>
        ) : (
          <code className="">{addressToDisplay}</code>
        )}
      </Tooltip>
      <div className={'w-4 h-4'}>
        {enableCopy && (
          <CopyButton textToCopy={address} tooltipPosition="top" />
        )}
      </div>
    </div>
  );
};
