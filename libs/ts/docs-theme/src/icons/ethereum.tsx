import type { ReactElement } from 'react';

export const EthereumIcon = (): ReactElement => {
  return (
    <svg
      aria-label="Ethereum"
      viewBox="0 0 256 256"
      width="1.25rem"
      height="1.25rem"
    >
      <rect width="256" height="256" rx="15%" fill="#ffffff" />
      <path fill="#3C3C3B" d="m128 181v54l65-92z" />
      <path fill="#343434" d="m128 20l65 109-65 39-66-39" />
      <path fill="#8C8C8C" d="m128 20v79l-66 30m0 13l66 39v54" />
      <path fill="#141414" d="m128 100v69l65-39" />
      <path fill="#393939" d="m62 128l66-30v69" />
    </svg>
  );
};
