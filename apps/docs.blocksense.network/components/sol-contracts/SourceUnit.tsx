import React from 'react';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';

import { AbsolutePath } from '@/sol-contracts-components/AbsolutePath';
import { Pragmas } from '@/sol-contracts-components/Pragmas';
import { License } from '@/sol-contracts-components/License';
import { Contracts } from '@/sol-contracts-components/Contracts';
import { Enums } from '@/sol-contracts-components/Enums';
import { Errors } from '@/sol-contracts-components/Errors';
import { Functions } from '@/sol-contracts-components/Functions';
import { Structs } from '@/sol-contracts-components/Structs';
import { Variables } from '@/sol-contracts-components/Variables';

type SourceUnitProps = {
  sourceUnit: SourceUnitDocItem;
};

export const SourceUnit = ({ sourceUnit }: SourceUnitProps) => {
  return (
    <div>
      <AbsolutePath absolutePath={sourceUnit.absolutePath} />
      <License license={sourceUnit.license} />
      <Pragmas pragmas={sourceUnit.pragmas} />
      <Contracts contracts={sourceUnit.contracts} />
      <Enums enums={sourceUnit.enums} />
      <Errors errors={sourceUnit.errors} />
      <Functions functions={sourceUnit.functions} />
      <Structs structs={sourceUnit.structs} />
      <Variables variables={sourceUnit.variables} />
    </div>
  );
};
