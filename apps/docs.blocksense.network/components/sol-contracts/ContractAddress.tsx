import * as React from 'react';

import Link from 'next/link';

import { Tooltip } from '@/components/common/Tooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { previewHexStringOrDefault } from '@/src/utils';
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
  hasAbbreviation?: boolean;
};

export const ContractAddress = ({
  network,
  address,
  enableCopy,
  hasAbbreviation,
}: ContractAddressProps) => {
  if (!address) {
    return '-';
  }

  if (!isEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const addressToDisplay = hasAbbreviation
    ? previewHexStringOrDefault(address)
    : address;

  return (
    <div className={cn(enableCopy && 'flex items-start gap-2')}>
      <Tooltip contentClassName="bg-gray-900 text-white">
        {hasAbbreviation && <Tooltip.Content>{address}</Tooltip.Content>}
        {network ? (
          <code className="hover:underline">
            <Link
              href={getAddressExplorerUrl(network, address)}
              onClick={e => e.stopPropagation()}
              target="_blank"
            >
              {addressToDisplay}
            </Link>
          </code>
        ) : (
          <code>{addressToDisplay}</code>
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
