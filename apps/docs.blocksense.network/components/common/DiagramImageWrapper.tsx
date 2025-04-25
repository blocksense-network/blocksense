import React from 'react';
import Image from 'next/image';

type DiagramImageProps = {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
};

export const DiagramImageWrapper = ({
  src,
  alt = 'Blocksense diagram',
  className = 'blocksense__diagram',
  width = 800,
  height = 600,
}: DiagramImageProps) => {
  return (
    <div className={`${className}`}>
      <Image src={src} alt={alt} width={width} height={height} quality={50} />
    </div>
  );
};
