import * as React from 'react';
import { Button } from 'nextra/components';

import { networkMetadata, parseNetworkName } from '@blocksense/base-utils/evm';

import { ImageWrapper } from '../common/ImageWrapper';

type NetworkIconProps = {
  network: string;
  onClick: () => void;
};

export const NetworkIcon = ({ network, onClick }: NetworkIconProps) => {
  const chainId = networkMetadata[parseNetworkName(network)].chainId;
  const iconPath = `/images/network-icons/${network.split('-')[0]}.png`;

  return (
    <Button
      className="bg-gray-100 text-black w-36 h-36 aspect-square flex flex-col items-center justify-center rounded-md"
      onClick={onClick}
    >
      {' '}
      <ImageWrapper
        src={iconPath}
        alt={network}
        className="relative w-12 h-12"
      />
      <div className="pt-2 font-bold text-xs">{network}</div>
      <div className="pt-2 font-semibold text-xs">{chainId}</div>
    </Button>
  );
};
