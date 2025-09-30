import React from 'react';
import type { MouseEventHandler } from 'react';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizes = {
  xs: 'icon--xs-size h-[16px] w-[16px]',
  sm: 'icon--sm-size h-[20px] w-[20px]',
  md: 'icon--md-size h-[24px] w-[24px]',
  lg: 'icon--lg-size h-[32px] w-[32px]',
  xl: 'icon--xl-size h-[48px] w-[48px]',
};

type IconType = {
  type: 'vector' | 'image';
  src: string;
};

type IconProps = {
  icon: IconType;
  className?: string;
  size?: Size;
  color?: string;
  onClick?: MouseEventHandler<SVGSVGElement | HTMLImageElement>;
  ariaLabel: string;
};

export const Icon = ({
  ariaLabel,
  className,
  color,
  icon,
  onClick,
  size = 'md',
}: IconProps) => {
  const cursorClass = onClick ? 'cursor-pointer' : '';

  switch (icon.type) {
    case 'vector':
      return (
        <svg
          className={`${sizes[size]} ${color} ${className} ${cursorClass}`}
          onClick={onClick}
          aria-label={ariaLabel}
          fill={color}
        >
          <path d={icon.src} />
        </svg>
      );
    case 'image':
      return (
        <img
          className={`${sizes[size]} ${color} ${className} ${cursorClass}`}
          src={icon.src}
          onClick={onClick}
          alt={ariaLabel}
        />
      );
  }
};
