'use client';

import { usePathname } from 'next/navigation';

import { CodeBlock } from '@/components/common/CodeBlock';
import {
  getOverviewCodeContent,
  transformerOverviewLineLink,
} from '@/src/contract-overview';

type ContractOverviewProps = {
  contractString: string;
};

export const ContractOverview = ({ contractString }: ContractOverviewProps) => {
  const pathName = usePathname();

  return (
    <CodeBlock
      code={getOverviewCodeContent(JSON.parse(contractString))}
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
