import React from 'react';
import { config } from '@/config';

export const Header = () => {
  return (
    <header className="header__media flex items-center z-50">
      <span className="header-media__description tracking-wide leading-normal text-gray-900">
        {config.blocksenseText}
      </span>
    </header>
  );
};
