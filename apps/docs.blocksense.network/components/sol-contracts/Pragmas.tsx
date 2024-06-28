import React from 'react';

import { PragmaDocItem } from '@blocksense/sol-reflector';

type PragmasProps = {
  pragmas: PragmaDocItem[];
};

export const Pragmas = ({ pragmas }: PragmasProps) => {
  return (
    <span>
      {pragmas.map(
        pragma => `pragma ${pragma.literals.map(literal => literal).join('')}`,
      )}
    </span>
  );
};
