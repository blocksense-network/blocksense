'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';

import { Button } from './Button';

type ClaimNFTButtonProps = {
  className?: string;
  linkClassName?: string;
  onClick?: () => void;
};

export const ClaimNFTButton = ({
  className = '',
  linkClassName = '',
  onClick,
}: ClaimNFTButtonProps) => {
  const onClaimClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const mintForm = document.getElementById('mint-form');
    if (mintForm) {
      const mintFormTop =
        mintForm.getBoundingClientRect().top + window.scrollY - 61.6;
      window.scrollTo({
        top: mintFormTop,
        behavior: 'smooth',
      });
    }

    if (onClick) {
      onClick();
    }
  };

  return (
    <Link href="#mint-form" className={`claim-nft__link ${linkClassName}`}>
      <Button
        className={`button__claim-nft ${className}`}
        onClick={onClaimClick}
      >
        Claim Your Pirate NFT
      </Button>
    </Link>
  );
};
