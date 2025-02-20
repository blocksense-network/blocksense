import Link from 'next/link';

import { contractsUrl } from '@/src/constants';

interface AnchorLinkProps {
  label: string;
}

export const ContractAnchorLink = ({ label }: AnchorLinkProps) => {
  return (
    <li key={label} className="flex items-start nx-gap-4 nx-my-2">
      <span className="grow contract__anchor mb-1 underline text-black dark:text-white">
        <strong>
          <Link href={`${contractsUrl}/contract/${label}`}>{label}</Link>
        </strong>
      </span>
    </li>
  );
};
