import Image from 'next/image';

import iconBlack from '../../assets/logos/icon-black.svg';
import iconBlackWhite from '../../assets/logos/icon-black-white.svg';
import iconNeon from '../../assets/logos/icon-neon.svg';
import iconWhite from '../../assets/logos/icon-white.svg';
import logoMarkBlack from '../../assets/logos/logo-mark-black.svg';
import logoMarkBlackWhite from '../../assets/logos/logo-mark-black-white.svg';
import logoMarkNeon from '../../assets/logos/logo-mark-neon.svg';
import logoMarkWhite from '../../assets/logos/logo-mark-white.svg';
import primaryBlack from '../../assets/logos/primary-black.svg';
import primaryNeon from '../../assets/logos/primary-neon.svg';
import primaryWhite from '../../assets/logos/primary-white.svg';
import secondaryBlack from '../../assets/logos/secondary-black.svg';
import secondaryNeon from '../../assets/logos/secondary-neon.svg';
import secondaryWhite from '../../assets/logos/secondary-white.svg';

type LogoType = 'primary' | 'secondary' | 'logo-mark' | 'icon';
type LogoColor = 'white' | 'black' | 'neon' | 'black-white';

type LogoProps = {
  className?: string;
  type: LogoType;
  color: LogoColor;
  alt?: string;
};

const logoMap = {
  icon: {
    white: iconWhite,
    black: iconBlack,
    neon: iconNeon,
    'black-white': iconBlackWhite,
  },
  'logo-mark': {
    white: logoMarkWhite,
    black: logoMarkBlack,
    neon: logoMarkNeon,
    'black-white': logoMarkBlackWhite,
  },
  primary: {
    white: primaryWhite,
    black: primaryBlack,
    neon: primaryNeon,
    'black-white': '',
  },
  secondary: {
    white: secondaryWhite,
    black: secondaryBlack,
    neon: secondaryNeon,
    'black-white': '',
  },
};

export const Logo = ({ className, type, color }: LogoProps) => {
  const src = logoMap[type][color];
  if (!src) return null;

  return (
    <Image className={className} src={src} alt={'Blocksense Network Logo'} />
  );
};
