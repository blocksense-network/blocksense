import { StructDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';

type StructsProps = {
  structs?: StructDocItem[];
  isFromSourceUnit?: boolean;
};

export const Structs = ({ structs = [], isFromSourceUnit }: StructsProps) => {
  return (
    <ContractItemWrapper
      title="Structs"
      titleLevel={isFromSourceUnit ? 2 : 3}
      nonEmpty={!!structs.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(structs)}>
        {structs.map(struct => (
          <section key={struct.name} className="struct-details__container">
            <section className="struct-details__visibility">
              <strong className="mb-1 font-semibold text-gray-900 dark:text-white">
                Visibility:
              </strong>
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-500 italic">
                {struct.visibility}
              </span>
            </section>
            <section className="struct-details__natspec mt-6 mb-4">
              <NatSpec natspec={struct.natspec} />
            </section>
            {struct._members && struct._members.length > 0 && (
              <section className="struct-details__members mb-4">
                <Parameters
                  parameters={struct._members}
                  parentTitle={struct.name}
                  title="Members"
                  titleLevel={isFromSourceUnit ? 5 : 6}
                  columns={['type', 'name', 'dataLocation', 'description']}
                />
              </section>
            )}
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
