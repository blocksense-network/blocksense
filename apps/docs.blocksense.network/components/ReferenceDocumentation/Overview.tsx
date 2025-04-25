import * as path from 'path';
import { ContractAnchorLink } from '@/sol-contracts-components/ContractAnchorLink';

import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

export const Overview = () => {
  return (
    <ul className="overview__list mt-6 nx-list-none first:nx-mt-0 ltr:nx-ml-0 rtl:nx-mr-6">
      {solReflection.map((sourceUnit: SourceUnitDocItem) => (
        <ContractAnchorLink
          key={sourceUnit.absolutePath}
          label={path.parse(sourceUnit.absolutePath).name}
        />
      ))}
    </ul>
  );
};
