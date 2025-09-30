import React from 'react';

type ImageProps = {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
};

export const ImageWrapper = ({
  alt = ' ',
  className = ' ',
  onClick,
  src,
}: ImageProps) => {
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
};
