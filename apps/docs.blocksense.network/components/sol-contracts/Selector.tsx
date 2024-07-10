import React from 'react';

type SelectorProps = {
  selector?: string;
};

export const Selector = ({ selector = '' }: SelectorProps) => {
  return (
    selector && <span className="bg-gray-100 p-1 rounded">0x{selector}</span>
  );
};
