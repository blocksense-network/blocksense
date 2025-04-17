import { HTMLAttributes } from 'react';

type SeparatorProps = HTMLAttributes<HTMLHRElement>;

export const Separator = ({ className }: SeparatorProps) => {
  return <hr className={`text-[var(--gray-dark)] ${className}`} />;
};
