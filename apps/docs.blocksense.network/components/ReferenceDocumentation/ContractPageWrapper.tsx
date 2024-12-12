import { SourceUnit } from './SourceUnit';
import { getSourceUnit } from './SourceUnit';
import { Error404 } from '@/components/common/Error404';

type ContractPageWrapperProps = {
  title: string;
};

export async function ContractPageWrapper({ title }: ContractPageWrapperProps) {
  const sourceUnit = await getSourceUnit(title);

  if (!sourceUnit) {
    return <Error404 />;
  } else {
    return <SourceUnit sourceUnit={sourceUnit} />;
  }
}
