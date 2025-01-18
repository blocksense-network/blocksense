'use client';

import { ContractDocItem } from '@blocksense/sol-reflector';
import { usePathname } from 'next/navigation';

import { transformerOverviewLineLink } from '@/src/contract-overview';
import { getOverviewCodeContent } from '@/src/contract-overview';
import { CodeBlock } from '@/components/common/CodeBlock';

type ContractOverviewProps = {
  contract: ContractDocItem;
};

export const ContractOverview = ({ contract }: ContractOverviewProps) => {
  const pathName = usePathname();

  return (
    <CodeBlock
      code={getOverviewCodeContent(contract)}
      lang="solidity"
      transformers={[
        transformerOverviewLineLink({
          routeLink: pathName,
          classes: [
            'p-1 hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer',
          ],
        }),
      ]}
    />
  );
};
