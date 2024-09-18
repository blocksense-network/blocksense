import * as React from 'react';

import Link from 'next/link';

import { Tooltip } from '@/components/common/Tooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { previewHexStringOrDefault } from '@/src/utils';
import {
  EthereumAddress,
  explorerAddressUrls,
  isEthereumAddress,
} from '@blocksense/base-utils/evm-utils';
import { cn } from '@/lib/utils';

type ContractAddressProps = {
  network?: string;
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
              href={explorerAddressUrls[
                network as keyof typeof explorerAddressUrls
              ](address as EthereumAddress)}
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
