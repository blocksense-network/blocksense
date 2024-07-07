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
    <section className="source-unit mt-6">
      <section className="source-unit__header flex space-x-4">
        <AbsolutePath
          className="source-unit__absolute-path"
          absolutePath={sourceUnit.absolutePath}
        />
        <License
          className="source-unit__license"
          license={sourceUnit.license}
        />
        <Pragmas
          className="source-unit__pragmas"
          pragmas={sourceUnit.pragmas}
        />
      </section>
      <Contracts
        className="source-unit__contracts"
        contracts={sourceUnit.contracts}
      />
      <Enums className="source-unit__enums" enums={sourceUnit.enums} />
      <Errors className="source-unit__errors" errors={sourceUnit.errors} />
      <Functions
        className="source-unit__functions"
        functions={sourceUnit.functions}
      />
      <Structs className="source-unit__structs" structs={sourceUnit.structs} />
      <Variables
        className="source-unit__variables"
        variables={sourceUnit.variables}
        title="Variables"
      />
    </section>
  );
};
