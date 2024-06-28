import React from 'react';

type AbsolutePathProps = {
  absolutePath: string;
};

export const AbsolutePath = ({ absolutePath }: AbsolutePathProps) => {
  return <span>{absolutePath}</span>;
};
