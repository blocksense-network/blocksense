'use client';

import Link from 'next/link';
import { MouseEvent } from 'react';

import { Button } from './Button';

type ClaimNFTButtonProps = {
  className?: string;
  onClick?: () => void;
};

export const ClaimNFTButton = ({
  className = '',
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
    <Link href="#mint-form">
      <Button
        className={`button__claim-nft ${className}`}
        onClick={onClaimClick}
      >
        Claim your very own pirate NFT
      </Button>
    </Link>
  );
};
