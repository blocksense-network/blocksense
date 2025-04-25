import { HTMLAttributes } from 'react';

type SeparatorProps = HTMLAttributes<HTMLHRElement>;

export const Separator = ({ className }: SeparatorProps) => {
  return <hr className={`separator text-[var(--gray-dark)] ${className}`} />;
};
