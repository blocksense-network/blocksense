import { SourceUnit } from './SourceUnit';
import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import { createGetStaticProps } from './SourceUnit';
import { Error404 } from '@/components/common/Error404';

type ContractPageWrapperProps = {
  title: string;
};

type SourceUnitProps = {
  sourceUnit: SourceUnitDocItem;
};

export function ContractPageWrapper({ title }: ContractPageWrapperProps) {
  const ContractPage = ({ sourceUnit }: SourceUnitProps) => {
    if (!sourceUnit) {
      return <Error404 />;
    } else {
      return <SourceUnit sourceUnit={sourceUnit} />;
    }
  };

  ContractPage.getStaticProps = createGetStaticProps(title);

  return ContractPage;
}
