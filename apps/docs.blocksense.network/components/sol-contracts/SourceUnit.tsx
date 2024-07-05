import React, { useEffect } from 'react';

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
  sourceUnitJsonString: string;
};

export const SourceUnit = ({
  sourceUnitJsonString: sourceUnitJson,
}: SourceUnitProps) => {
  const sourceUnit: SourceUnitDocItem = JSON.parse(sourceUnitJson);
  return (
    <section className="mt-6">
      <section className="flex space-x-4">
        <AbsolutePath absolutePath={sourceUnit.absolutePath} />
        <License license={sourceUnit.license} />
        <Pragmas pragmas={sourceUnit.pragmas} />
      </section>
      <Contracts contracts={sourceUnit.contracts} />
      <Enums enums={sourceUnit.enums} />
      <Errors errors={sourceUnit.errors} />
      <Functions functions={sourceUnit.functions} />
      <Structs structs={sourceUnit.structs} />
      <Variables variables={sourceUnit.variables} title="Variables" />
    </section>
  );
};
