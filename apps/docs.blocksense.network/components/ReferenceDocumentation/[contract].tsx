import * as path from 'path';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
import type { SourceUnitDocItem } from '@blocksense/sol-reflector';
import { Error404 } from '@/components/common/Error404';
import { SourceUnit } from '@/components/ReferenceDocumentation/SourceUnit';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

export function generateStaticParams() {
  return solReflection.map((contract: SourceUnitDocItem) => ({
    contract: path.parse(contract.absolutePath).name,
  }));
}

type ContractProps = {
  params: {
    contract: string;
  };
};

export default async function Contract({ params }: ContractProps) {
  const { contract: contractName } = await params;

  const sourceUnit = solReflection.find((info: SourceUnitDocItem) => {
    if (!info || !info.absolutePath) {
      return false;
    }
    return path.parse(info.absolutePath).name === contractName;
  });

  if (!sourceUnit) {
    console.error(`No deployment info found for contract: ${contractName}`);
    return <Error404 />;
  }

  return <SourceUnit sourceUnit={sourceUnit} />;
}
