'use client';

import React, { useState, useEffect } from 'react';

type ProgressBarProps = {
  value?: number;
  isIndeterminate?: boolean;
  size?: number;
  className?: string;
};

export const ProgressBar = ({
  value = 0,
  isIndeterminate = false,
  size = 40,
  className = '',
}: ProgressBarProps) => {
  const [animatedValue, setAnimatedValue] = useState(value);

  useEffect(() => {
    setAnimatedValue(value);
  }, [value]);

  return (
    <section
      className={`progress-bar progress-bar__wrapper flex items-center justify-center w-full ${className}`}
      aria-live="polite"
    >
      {isIndeterminate ? (
        <svg
          className="progress-bar__spinner progress-bar__spinner--animate animate-spin text-blue-700"
          width={size}
          height={size}
          viewBox="0 0 50 50"
          xmlns="http://www.w3.org/2000/svg"
          role="progressbar"
          aria-label="Loading"
        >
          <circle
            className="progress-bar__circle progress-bar__circle--bg opacity-25"
            cx="25"
            cy="25"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          ></circle>
          <circle
            className="progress-bar__circle progress-bar__circle--fg opacity-75"
            cx="25"
            cy="25"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray="80"
            strokeLinecap="round"
            fill="none"
          ></circle>
        </svg>
      ) : (
        <progress
          className="progress-bar__progress w-full h-2.5 bg-gray-100 rounded-full"
          value={animatedValue}
          max={100}
          role="progressbar"
          aria-valuenow={animatedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress"
        >
          <span
            className="progress-bar__progress-fill h-2.5 rounded-full bg-blue-700 transition-all duration-300 ease-in-out"
            aria-hidden="true"
          />
        </progress>
      )}
    </section>
  );
};

ProgressBar.displayName = 'ProgressBar';
