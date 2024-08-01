import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ButtonProps {
  href?: string;
  external?: boolean;
  className?: string;
  children?: React.ReactNode;
  asChild?: true;
}

export const LinkButton = ({
  href,
  external = false,
  className,
  children,
}: ButtonProps) => {
  const classes = `link_button me-2 mb-2 font-bold ${className} `;

  return (
    <Button className={classes} asChild>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        href && <Link href={href}>{children}</Link>
      )}
    </Button>
  );
};
