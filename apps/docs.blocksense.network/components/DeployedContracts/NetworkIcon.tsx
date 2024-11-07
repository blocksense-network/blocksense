import * as React from 'react';
import { ImageWrapper } from '../common/ImageWrapper';
import { networkMetadata, parseNetworkName } from '@blocksense/base-utils/evm';

type NetworkIconProps = {
  network: string;
};

export const NetworkIcon = ({ network }: NetworkIconProps) => {
  console.log(network);
  const chainId = networkMetadata[parseNetworkName(network)].chainId;
  const iconPath = `/images/network-icons/${network.split('-')[0]}.png`;
  return (
    <div className="p-2 bg-gray-100 text-black w-36 h-36 aspect-square flex flex-col items-center justify-center rounded-md">
      {' '}
      <ImageWrapper
        src={iconPath}
        alt={network}
        className="relative w-16 h-16"
      />
      <div className="pt-2 font-bold text-xs">{network}</div>
      <div className="pt-2 font-semibold text-xs">ChainId:{chainId}</div>
    </div>
  );
};
