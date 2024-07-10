import React from 'react';

type SelectorProps = {
  selector?: string;
};

export const Selector = ({ selector = '' }: SelectorProps) => {
  return (
    selector && (
      <p className="bg-gray-100 p-1 mt-3 rounded w-fit">0x{selector}</p>
    )
  );
};
