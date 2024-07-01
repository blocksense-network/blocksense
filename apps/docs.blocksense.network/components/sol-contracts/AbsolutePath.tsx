import React from 'react';

import { ghContractFolder } from '@/src/constants';

type AbsolutePathProps = {
  absolutePath: string;
};

export const AbsolutePath = ({ absolutePath }: AbsolutePathProps) => {
  return <span>{ghContractFolder + absolutePath}</span>;
};
