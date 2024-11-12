import * as React from 'react';
import { ImageWrapper } from '../common/ImageWrapper';
import { networkMetadata, parseNetworkName } from '@blocksense/base-utils/evm';
import { Button } from 'nextra/components';

type NetworkIconProps = {
  network: string;
  onClick: () => void;
};

export const NetworkIcon = ({ network, onClick }: NetworkIconProps) => {
  const chainId = networkMetadata[parseNetworkName(network)].chainId;
  const iconPath = `/images/network-icons/${network.split('-')[0]}.png`;
  return (
    <Button
      className="transition-all duration-300 ease-in-out p-2 bg-zinc-100/50 text-black w-[7.2rem] h-[7.2rem] md:w-[7.6rem] md:h-[7.6rem] md:p-1 aspect-square flex flex-col items-center justify-center rounded-sm hover:bg-slate-300/25"
      onClick={onClick}
    >
      {' '}
      <ImageWrapper
        src={iconPath}
        alt={network}
        className="relative w-10 h-10"
      />
      <div className="pt-2 font-bold text-xs">{network}</div>
      <div className="pt-2 font-semibold text-xs">ChainId:{chainId}</div>
    </Button>
  );
};
