import React from 'react';
import * as path from 'path';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

import { SourceUnitClient } from '@/components/ReferenceDocumentation/SourceUnitClient';

export function getSourceUnit(title: string) {
  const sourceUnit = solReflection.find((info: SourceUnitDocItem) => {
    if (!info || !info.absolutePath) {
      return false;
    }

    return path.parse(info.absolutePath).name === title;
  });

  if (!sourceUnit) {
    throw new Error(`No deployment info found for contract: ${title}`);
  }

  return sourceUnit;
}

type SourceUnitProps = {
  sourceUnit: SourceUnitDocItem;
};

export const SourceUnit = ({ sourceUnit }: SourceUnitProps) => (
  <SourceUnitClient sourceUnit={sourceUnit} />
);
