'use client';

import { ChangeEvent, InputHTMLAttributes } from 'react';
import Image from 'next/image';

import checkIcon from '/public/icons/check.svg';
import exclamationIcon from '/public/icons/exclamation.svg';
import { StatusMessage, StatusType } from './StatusMessage';
import { InputLoadingIcon } from './InputLoadingIcon';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  isLoading?: boolean;
  labelClassName?: string;
  status?: StatusType;
  message?: string;
};

export const Input = ({
  value = '',
  className = '',
  disabled,
  isLoading,
  id,
  labelClassName = '',
  status,
  message,
  onChange,
  ...props
}: InputProps) => {
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isLoading || disabled) {
      e.preventDefault();
      return;
    }

    if (onChange) {
      onChange(e);
    }
  };

  const borderColor = isLoading
    ? 'border-[var(--gray-light)]'
    : status === 'error'
      ? 'border-[var(--red)]'
      : status === 'success'
        ? 'border-[var(--green)]'
        : 'border-[var(--gray-dark)]';

  return (
    <article className="input__container flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`input__label flex md:gap-3 gap-2 items-center rounded-2xl md:px-4 md:py-5 p-4 text-[var(--gray-medium)] border ${borderColor} hover:border-[var(--gray-light)] focus-within:border-[var(--gray-light)] transition duration-300 ease-in-out ${labelClassName}`}
      >
        <input
          id={id}
          className={`input flex-1 bg-transparent focus:outline-none ${className}`}
          disabled={disabled}
          onChange={onInputChange}
          value={value}
          {...props}
        />
        {isLoading ? (
          <InputLoadingIcon />
        ) : (
          <>
            {status === 'error' && (
              <Image
                src={exclamationIcon}
                alt="Error"
                className="input__error-icon"
              />
            )}
            {status === 'success' && (
              <Image
                src={checkIcon}
                alt="Success"
                className="input__success-icon"
              />
            )}
          </>
        )}
      </label>
      {!isLoading && <StatusMessage status={status} message={message} />}
    </article>
  );
};
