'use client';

import { ButtonHTMLAttributes, MouseEvent } from 'react';
import * as motion from 'motion/react-client';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
};

export const Button = ({
  children,
  className = '',
  disabled,
  isLoading,
  onClick,
  variant = 'primary',
  ...props
}: ButtonProps) => {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const variantStyle = {
    primary: 'bg-[var(--neon-yellow)]',
    secondary: 'bg-[var(--white)]',
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        scale: 1.045,
        transition: {
          type: 'spring',
          stiffness: 140,
          damping: 12,
        },
      }}
      whileTap={{
        scale: 0.965,
        transition: {
          type: 'spring',
          stiffness: 180,
          damping: 15,
        },
      }}
      className={`button relative z-0 overflow-hidden will-change-transform ${variantStyle[variant]} text-[var(--black)] px-8 py-4 cursor-pointer rounded-[2.5rem] font-bold tracking-[-0.32px] leading-[120%] transition-colors duration-300 ease-in-out ${
        disabled ? 'opacity-[0.3] pointer-events-none' : ''
      } ${
        isLoading
          ? `${variantStyle['secondary']} flex gap-1 items-center justify-center`
          : ''
      } ${className}`}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
      {isLoading && (
        <img
          src="/icons/loading.svg"
          alt="Loading"
          className="animate-spin ml-2"
        />
      )}
    </motion.button>
  );
};
