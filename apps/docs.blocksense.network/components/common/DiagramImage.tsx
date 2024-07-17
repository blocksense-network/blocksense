import React from 'react';

type DiagramImageProps = {
  src: string;
  alt?: string;
  className?: string;
};

export const DiagramImage = ({
  src,
  alt = ' ',
  className = ' ',
}: DiagramImageProps) => {
  return <img src={src} alt={alt} className={`w-full h-auto ${className}`} />;
};
