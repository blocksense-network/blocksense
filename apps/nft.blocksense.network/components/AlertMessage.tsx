import { useMintFormContext } from 'app/contexts/MintFormContext';

export const AlertMessage = () => {
  const { alertMessage } = useMintFormContext();

  if (!alertMessage) {
    return null;
  }

  return (
    <p
      role="alert"
      className="alert-message border border-[var(--gray-dark)] rounded-full text-center px-4 py-2 text-xs mt-2"
    >
      {alertMessage}
    </p>
  );
};
