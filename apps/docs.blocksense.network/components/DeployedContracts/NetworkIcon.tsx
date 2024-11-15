import * as React from 'react';
import { Button } from 'nextra/components';

import { ImageWrapper } from '../common/ImageWrapper';

type NetworkIconProps = {
  network: string;
  isSelected: boolean;
  onClick: () => void;
};

const capitalizeWords = (input: string): string => {
  return input
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const NetworkIcon = ({
  network,
  isSelected,
  onClick,
}: NetworkIconProps) => {
  const iconPath = `/images/network-icons/${network.split('-')[0]}.png`;

  return (
    <Button
      className={` text-black w-32 h-32 mt-0 aspect-square flex flex-col items-center justify-center rounded-md transition-all active:scale-95 hover:bg-gray-200 focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 ${isSelected && 'bg-blue-100 border-blue-400'}`}
      onClick={onClick}
    >
      <ImageWrapper
        src={iconPath}
        alt={network}
        className="relative w-14 h-14"
      />
      <div className="pt-4 font-bold text-xs">{capitalizeWords(network)}</div>
    </Button>
  );
};
