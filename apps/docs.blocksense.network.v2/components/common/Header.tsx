import React from 'react';
import { config } from '@/config';

export const Header = () => {
  return (
    <header className="header__media flex items-center z-50">
      <span className="header-media__description font-mono-space-bold tracking-wide leading-normal text-[22px] text-gray-900">
        {config.blocksenseText}
      </span>
    </header>
  );
};
