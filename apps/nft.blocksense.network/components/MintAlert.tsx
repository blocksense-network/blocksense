type MintAlertProps = {
  message?: string;
  className?: string;
};

export const MintAlert = ({ message, className }: MintAlertProps) => (
  <p
    role="alert"
    className={`alert-message border border-[var(--gray-dark)] rounded-full text-center mt-4 px-4 py-2 text-xs${className ? ` ${className}` : ''}`}
  >
    {message}
  </p>
);
