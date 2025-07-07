'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Tooltip } from '@blocksense/docs-ui/Tooltip';
import { CopyButton } from '@blocksense/docs-ui/CopyButton';
import { onLinkClick, previewHexStringOrDefault } from '@/src/utils';
import {
  getAddressExplorerUrl,
  isEthereumAddress,
  NetworkName,
} from '@blocksense/base-utils/evm';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type ContractAddressProps = {
  network?: NetworkName;
  address: string;
  copyButton?: {
    enableCopy?: boolean;
    background?: boolean;
  };
  abbreviation?: {
    hasAbbreviation?: boolean;
    bytesToShow?: number;
  };
};

export const ContractAddress = ({
  network,
  address,
  copyButton = { enableCopy: true, background: true },
  abbreviation = { hasAbbreviation: false, bytesToShow: 6 },
}: ContractAddressProps) => {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 890px)');

  if (!address) {
    return <span className="flex justify-center items-center">-</span>;
  }

  if (!isEthereumAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }

  const addressToDisplay = isDesktop
    ? abbreviation?.hasAbbreviation
      ? previewHexStringOrDefault(address, '-', abbreviation.bytesToShow)
      : address
    : previewHexStringOrDefault(address, '-', 6);

  return (
    <section className="flex gap-1.5 items-center">
      <Tooltip contentClassName="bg-gray-900 text-white">
        {abbreviation?.hasAbbreviation && (
          <Tooltip.Content>{address}</Tooltip.Content>
        )}
        {network ? (
          <code className="hover:underline">
            <Link
              className="font-mono"
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
          <code>{addressToDisplay}</code>
        )}
      </Tooltip>
      {copyButton.enableCopy && (
        <CopyButton
          textToCopy={address}
          tooltipPosition="top"
          background={copyButton.background}
        />
      )}
    </section>
  );
};
