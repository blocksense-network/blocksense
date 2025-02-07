import React from 'react';

import {
  EnumDocItem,
  ErrorDocItem,
  EventDocItem,
  FunctionDocItem,
  ModifierDocItem,
  SourceUnitDocItem,
  StructDocItem,
  VariableDocItem,
} from '@blocksense/sol-reflector';

import { AbsolutePath } from '@/sol-contracts-components/AbsolutePath';
import { License } from '@/sol-contracts-components/License';
import { Contracts } from '@/sol-contracts-components/Contracts';
import { Enums } from '@/sol-contracts-components/Enums';
import { Errors } from '@/sol-contracts-components/Errors';
import { Functions } from '@/sol-contracts-components/Functions';
import { Structs } from '@/sol-contracts-components/Structs';
import { Variables } from '@/sol-contracts-components/Variables';
import { filterConstants, filterVariables } from '@/src/utils';

type SourceUnitProps = {
  sourceUnit: SourceUnitDocItem;
};

type ContractElements =
  | FunctionDocItem[]
  | VariableDocItem[]
  | ModifierDocItem[]
  | EnumDocItem[]
  | StructDocItem[]
  | EventDocItem[]
  | ErrorDocItem[];

export function getContractElementsNames(elements: ContractElements) {
  return elements.map(element => {
    if ('kind' in element) {
      return element.name || element.kind;
    }
    return element.name;
  });
}

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
