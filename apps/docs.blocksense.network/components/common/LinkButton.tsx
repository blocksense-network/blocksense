import React from 'react';
import { Link } from 'nextra-theme-docs';
import { Button } from '@/components/ui/button';

interface ButtonProps {
  href?: string;
  external?: boolean;
  className?: string;
  label?: string;
  asChild?: true;
}

export const LinkButton = ({
  href,
  external = false,
  className,
  label,
}: ButtonProps) => {
  const classes = `link_button me-2 mb-2 font-bold ${className} `;

  return (
    <Button className={classes} asChild>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        href && <Link href={href}>{label}</Link>
      )}
    </Button>
  );
};
