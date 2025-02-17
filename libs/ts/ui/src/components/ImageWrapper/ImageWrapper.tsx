import React from 'react';
import Image from 'next/image';

type ImageProps = {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

export const ImageWrapper = ({
  src,
  alt = ' ',
  className = ' ',
  onClick,
}: ImageProps) => {
  return (
    <div className={`${className}`} onClick={onClick}>
      <Image src={src} alt={alt} fill quality={50} />
    </div>
  );
};
