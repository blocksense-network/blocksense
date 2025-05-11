import { HTMLAttributes } from 'react';

export type StatusType = 'error' | 'success' | 'loading' | 'none';

type StatusMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  message?: string;
  className?: string;
  status?: StatusType;
};

export const StatusMessage = ({
  message = '',
  className = '',
  status = 'none',
  ...props
}: StatusMessageProps) => {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`status-message text-xs leading-[120%] tracking-[-0.023rem] ${status === 'error' && 'text-[var(--red)]'} ${status === 'success' && 'text-[var(--green)]'} ${className}`}
      {...props}
    >
      {message}
    </p>
  );
};
