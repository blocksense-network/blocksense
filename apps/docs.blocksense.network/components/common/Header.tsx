import React from 'react';
import { config } from '../../config';

export const Header = () => {
  return (
    <header className="header__media flex items-center z-50">
      <video
        className="header-media__video header-media__video--interactive pb-1 mr-2"
        width="70"
        height="70"
        loop
        muted
        autoPlay
      >
        <source
          className="header-media__source header-media__source--interactive"
          src="/videos/blocksense-logo-video.mp4"
          type="video/mp4"
        />
        <track
          className="header-media__track header-media__track--interactive"
          kind="captions"
          src=""
          srcLang="en"
          label="Blocksense"
        />
        {config.videoNotSupportedMsg}
      </video>
      <span className="header-media__description font-bold font-mono text-gray-900 text-lg">
        {config.blocksenseText}
      </span>
    </header>
  );
};
