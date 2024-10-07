import type { ComponentProps, ReactElement } from 'react';

export const InformationCircleIcon = (
  props: ComponentProps<'svg'>,
): ReactElement => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width="24"
      height="24"
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="#1C274C" strokeWidth="1.5" />
      <path
        d="M12 17V11"
        stroke="#1C274C"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8" r="1" fill="#1C274C" />
    </svg>
  );
};
