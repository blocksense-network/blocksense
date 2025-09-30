import React from 'react';

import { Badge } from '@blocksense/docs-ui/Badge';
import type { PragmaDocItem } from '@blocksense/sol-reflector';

type PragmasProps = {
  pragmas: PragmaDocItem[];
};

export const Pragmas = ({ pragmas }: PragmasProps) => {
  return (
    <Badge className="pragmas" variant="highlight">
      {pragmas.map(
        pragma => `pragma ${pragma.literals.map(literal => literal).join('')}`,
      )}
    </Badge>
  );
};
