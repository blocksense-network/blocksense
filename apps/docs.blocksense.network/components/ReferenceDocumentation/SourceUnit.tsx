import React from 'react';
import * as path from 'path';
import type { GetStaticProps } from 'next';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

import { AbsolutePath } from '@/sol-contracts-components/AbsolutePath';
import { License } from '@/sol-contracts-components/License';
import { Contracts } from '@/sol-contracts-components/Contracts';
import { Enums } from '@/sol-contracts-components/Enums';
import { Errors } from '@/sol-contracts-components/Errors';
import { Functions } from '@/sol-contracts-components/Functions';
import { Structs } from '@/sol-contracts-components/Structs';
import { Variables } from '@/sol-contracts-components/Variables';
import { filterConstants, filterVariables } from '@/src/utils';

export const createGetStaticProps: (title: string) => GetStaticProps<{
  sourceUnit: SourceUnitDocItem;
}> = title => () => {
  const sourceUnit = solReflection.find((info: SourceUnitDocItem) => {
    if (!info || !info.absolutePath) {
      return false;
    }

    return path.parse(info.absolutePath).name === title;
  });

  if (!sourceUnit) {
    throw new Error(`No deployment info found for contract: ${title}`);
  }

  return { props: { sourceUnit }, revalidate: false };
};

type SourceUnitProps = {
  sourceUnit: SourceUnitDocItem;
};

export const SourceUnit = ({ sourceUnit }: SourceUnitProps) => {
  return (
    <section className="source-unit mt-6">
      <section className="source-unit__header flex gap-2 py-2.5">
        <AbsolutePath absolutePath={sourceUnit.absolutePath} />
        <License license={sourceUnit.license} />
      </section>
      <Enums enums={sourceUnit.enums} isFromSourceUnit />
      <Structs structs={sourceUnit.structs} isFromSourceUnit />
      <Variables
        variables={filterConstants(sourceUnit.variables)}
        title="Constants"
        titleLevel={2}
      />
      <Variables
        variables={filterVariables(sourceUnit.variables)}
        title="Variables"
        titleLevel={2}
      />
      <Errors errors={sourceUnit.errors} isFromSourceUnit />
      <Functions functions={sourceUnit.functions} isFromSourceUnit />
      <Contracts contracts={sourceUnit.contracts} />
    </section>
  );
};
