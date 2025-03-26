import * as React from 'react';
import { Button } from 'nextra/components';

import { ImageWrapper } from '@blocksense/ui/ImageWrapper';
import { capitalizeWords } from '@/src/utils';

type NetworkIconProps = {
  network: string;
  isSelected: boolean;
  onClick: () => void;
};

export const NetworkIcon = ({
  network,
  isSelected,
  onClick,
}: NetworkIconProps) => {
  const iconPath = `/images/network-icons/${network.split('-')[0]}.png`;

  return (
    <Button
      className={`w-32 h-32 mt-0 aspect-square flex flex-col items-center justify-center rounded-md transition-all active:scale-95 hover:bg-gray-200 focus:bg-blue-100 focus:ring-2 focus:ring-blue-400 ${isSelected && 'bg-blue-100 border-blue-400'}`}
      onClick={onClick}
    >
      <ImageWrapper
        src={iconPath}
        alt={network}
        className="relative w-14 h-14"
      />
      <div className="pt-4 font-bold text-xs dark:text-white">
        {capitalizeWords(network)}
      </div>
    </Button>
  );
};
