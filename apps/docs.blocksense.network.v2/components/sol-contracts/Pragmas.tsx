import React from 'react';
import { Badge } from '@/components/ui/badge';

import { PragmaDocItem } from '@blocksense/sol-reflector';

type PragmasProps = {
  pragmas: PragmaDocItem[];
};

export const Pragmas = ({ pragmas }: PragmasProps) => {
  return (
    <Badge className="pragmas" variant="secondary">
      {pragmas.map(
        pragma => `pragma ${pragma.literals.map(literal => literal).join('')}`,
      )}
    </Badge>
  );
};
