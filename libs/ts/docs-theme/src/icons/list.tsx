import type { ComponentProps, ReactElement } from 'react';

export const ListIcon = (props: ComponentProps<'svg'>): ReactElement => {
  return (
    <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 7L4 7"
        stroke="#1C274C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15 12L4 12"
        stroke="#1C274C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 17H4"
        stroke="#1C274C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
