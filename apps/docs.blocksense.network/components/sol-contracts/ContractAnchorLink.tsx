import Link from 'next/link';

// import { ListIcon } from "@/components/common/ListIcon";
import { contractsUrl } from '@/src/constants';

interface AnchorLinkProps {
  label: string;
}

export const ContractAnchorLink = ({ label }: AnchorLinkProps) => {
  return (
    <li key={label} className="flex items-start nx-gap-4 nx-my-2">
      {/* <ListIcon /> */}
      <span className="flex-grow">
        <strong>
          <Link href={`${contractsUrl}/contract/${label}`}>{label}</Link>
        </strong>
      </span>
    </li>
  );
};
