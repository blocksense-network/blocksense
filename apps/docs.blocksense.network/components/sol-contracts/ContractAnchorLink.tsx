import { ListIcon } from '@/components/common/ListIcon';
import { useRouter } from 'next/router';

interface AnchorLinkProps {
  label: string;
}

export const ContractAnchorLink = ({ label }: AnchorLinkProps) => {
  const router = useRouter();

  const constructedHref = `${router.pathname}/${label}`;

  return (
    <li key={label} className="flex items-start nx-gap-4 nx-my-2">
      <ListIcon></ListIcon>
      <span className="flex-grow">
        <strong>
          <a href={constructedHref}>{label}</a>
        </strong>
      </span>
    </li>
  );
};
