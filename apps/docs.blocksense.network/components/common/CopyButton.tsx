import React from 'react';

type CopyButtonProps = {
  textToCopy: string;
};

export const CopyButton = ({ textToCopy }: CopyButtonProps) => {
  const [isCopied, setIsCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return isCopied ? (
    <img src="/icons/check.svg" alt="Copied" className="w-5 h-5" />
  ) : (
    <img
      src="/icons/clipboard.svg"
      alt="Clipboard"
      onClick={onCopy}
      className="w-5 h-5 cursor-pointer"
    />
  );
};
