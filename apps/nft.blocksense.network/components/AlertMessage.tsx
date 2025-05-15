import { HTMLAttributes } from 'react';

type AlertMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  message?: string;
  className?: string;
};

export const AlertMessage = ({
  message = '',
  className = '',
  ...props
}: AlertMessageProps) => {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className={`alert-message border border-[var(--gray-dark)] rounded-full text-center px-4 py-2 text-xs ${className}`}
      {...props}
    >
      {message}
    </p>
  );
};
