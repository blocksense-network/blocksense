'use client';

import { InputHTMLAttributes, useState } from 'react';
import Image from 'next/image';

import copyIcon from '/public/icons/copy.svg';
import checkIcon from '/public/icons/check.svg';

type CopyInputProps = InputHTMLAttributes<HTMLInputElement> & {
  labelClassName?: string;
};

export const CopyInput = ({
  value = '',
  className = '',
  disabled,
  id,
  labelClassName = '',
  ...props
}: CopyInputProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const onCopyClick = () => {
    if (value === '') {
      return;
    }

    navigator.clipboard.writeText(value.toString());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <label
      htmlFor={id}
      className={`copy-input__label flex md:gap-3 gap-2 items-center border border-[var(--gray-dark)] ${isCopied && 'border-[var(--green)] bg-[var(--gray-dark)]'} text-[var(--gray-medium)] rounded-2xl md:px-4 md:py-5 p-4 ${isCopied ? 'border-[var(--green)]' : 'hover:border-[var(--gray-light)] focus-within:border-[var(--gray-light)]'} ${labelClassName}`}
    >
      <input
        id={id}
        className={`copy-input flex-1 bg-transparent focus:outline-none ${className}`}
        disabled={disabled}
        value={isCopied ? 'Copied' : value}
        readOnly
        onChange={() => {}}
        {...props}
      />
      <button
        type="button"
        onClick={onCopyClick}
        disabled={disabled}
        aria-label="Copy input content"
        className="copy-input__button w-6 h-6 flex items-center justify-center cursor-pointer"
      >
        {isCopied ? (
          <Image src={checkIcon} alt="Copied" />
        ) : (
          <Image src={copyIcon} alt="Copy" />
        )}
      </button>
    </label>
  );
};
