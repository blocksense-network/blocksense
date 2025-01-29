import * as path from 'path';
import { SourceUnit } from './SourceUnit';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

export function generateStaticParams() {
  return solReflection.map((contract: SourceUnitDocItem) => ({
    contract: path.parse(contract.absolutePath).name,
  }));
}

interface Params {
  contract: string;
}

export default async function ContractPageWrapper({
  params,
}: {
  params: Params;
}) {
  const { contract: contractName } = await params;

  const sourceUnit = solReflection.find((info: SourceUnitDocItem) => {
    if (!info || !info.absolutePath) {
      return false;
    }

    return path.parse(info.absolutePath).name === contractName;
  });

  if (!sourceUnit) {
    throw new Error(`No deployment info found for contract: ${contractName}`);
  }

  return <SourceUnit sourceUnit={sourceUnit} />;
}
