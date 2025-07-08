import Image from 'next/image';

import iconBlack from '../../public/logos/icon-black.svg';
import iconBlackWhite from '../../public/logos/icon-black-white.svg';
import iconNeon from '../../public/logos/icon-neon.svg';
import iconWhite from '../../public/logos/icon-white.svg';
import logoMarkBlack from '../../public/logos/logo-mark-black.svg';
import logoMarkBlackWhite from '../../public/logos/logo-mark-black-white.svg';
import logoMarkNeon from '../../public/logos/logo-mark-neon.svg';
import logoMarkWhite from '../../public/logos/logo-mark-white.svg';
import primaryBlack from '../../public/logos/primary-black.svg';
import primaryNeon from '../../public/logos/primary-neon.svg';
import primaryWhite from '../../public/logos/primary-white.svg';
import secondaryBlack from '../../public/logos/secondary-black.svg';
import secondaryNeon from '../../public/logos/secondary-neon.svg';
import secondaryWhite from '../../public/logos/secondary-white.svg';

type LogoType = 'primary' | 'secondary' | 'logo-mark' | 'icon';
type LogoColor = 'white' | 'black' | 'neon' | 'black-white';

type LogoProps = {
  className?: string;
  type: LogoType;
  color?: LogoColor;
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

export const Logo = ({
  className,
  type,
  color = 'white',
  alt = 'Blocksense Network Logo',
}: LogoProps) => {
  const src = logoMap[type][color];
  if (!src) return null;

  return <Image className={className} src={src} alt={alt} />;
};
