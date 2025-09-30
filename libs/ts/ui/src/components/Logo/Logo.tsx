import type { ImageProps } from 'next/image';
import Image from 'next/image';

import IconBlack from '../../assets/logos/icon-black.svg';
import IconBlackWhite from '../../assets/logos/icon-black-white.svg';
import IconNeon from '../../assets/logos/icon-neon.svg';
import IconWhite from '../../assets/logos/icon-white.svg';
import LogoMarkBlack from '../../assets/logos/logo-mark-black.svg';
import LogoMarkBlackWhite from '../../assets/logos/logo-mark-black-white.svg';
import LogoMarkNeon from '../../assets/logos/logo-mark-neon.svg';
import LogoMarkWhite from '../../assets/logos/logo-mark-white.svg';
import PrimaryBlack from '../../assets/logos/primary-black.svg';
import PrimaryNeon from '../../assets/logos/primary-neon.svg';
import PrimaryWhite from '../../assets/logos/primary-white.svg';
import SecondaryBlack from '../../assets/logos/secondary-black.svg';
import SecondaryNeon from '../../assets/logos/secondary-neon.svg';
import SecondaryWhite from '../../assets/logos/secondary-white.svg';

export const variants = {
  'icon-neon': IconNeon,
  'icon-white': IconWhite,
  'icon-black': IconBlack,
  'icon-black-white': IconBlackWhite,
  'logo-mark-neon': LogoMarkNeon,
  'logo-mark-white': LogoMarkWhite,
  'logo-mark-black': LogoMarkBlack,
  'logo-mark-black-white': LogoMarkBlackWhite,
  'primary-neon': PrimaryNeon,
  'primary-white': PrimaryWhite,
  'primary-black': PrimaryBlack,
  'secondary-neon': SecondaryNeon,
  'secondary-white': SecondaryWhite,
  'secondary-black': SecondaryBlack,
};

export type LogoVariant = keyof typeof variants;

export type LogoProps = {
  variant?: LogoVariant;
} & Omit<ImageProps, 'src' | 'alt'>;

export const Logo = ({ variant = 'primary-neon', ...props }: LogoProps) => {
  return (
    <Image
      src={variants[variant]}
      alt="Blocksense Network Logo"
      priority
      {...props}
    />
  );
};
