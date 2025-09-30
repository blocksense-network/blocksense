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
  alt = 'Blocksense diagram',
  className = 'blocksense__diagram',
  height = 600,
  src,
  width = 800,
}: DiagramImageProps) => {
  return (
    <div className={`${className}`}>
      <Image src={src} alt={alt} width={width} height={height} quality={50} />
    </div>
  );
};
