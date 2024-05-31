import React from 'react';
import { config } from '../../config';

export const Header = () => {
  return (
    <aside className="flex items-center">
      <video width="70" height="70" loop autoPlay muted className="pb-1 mr-4">
        <source src="/videos/blocksense-logo-video.mp4" type="video/mp4" />
        {config.videoNotSupportedMsg}
      </video>
      <p className="font-bold font-mono text-gray-900 sm:text-lg md:text-2xl lg:text-3xl">
        {config.blocksenseText}
      </p>
    </aside>
  );
};
