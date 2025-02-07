import { ErrorDocItem } from '@blocksense/sol-reflector';

import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Selector } from '@/sol-contracts-components/Selector';
import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';

type ErrorsProps = {
  errors?: ErrorDocItem[];
  isFromSourceUnit?: boolean;
};

export const Errors = ({ errors = [], isFromSourceUnit }: ErrorsProps) => {
  return (
    <ContractItemWrapper
      title="Errors"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={errors.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(errors)}>
        {errors?.map(error => (
          <section key={error.name} className="error-details__container">
            <section className="error-details__signature mb-4">
              <Signature signature={error.signature} />
            </section>
            <section className="error-details__natspec mb-4">
              <NatSpec natspec={error.natspec} />
            </section>
            {error._parameters && error._parameters.length > 0 && (
              <section className="error-details__parameters mb-4">
                <Parameters
                  parameters={error._parameters}
                  parentTitle={error.name}
                  title="Parameters"
                  titleLevel={isFromSourceUnit ? 5 : 6}
                  columns={['type', 'name', 'dataLocation', 'description']}
                />
              </section>
            )}
            <footer className="error-details__footer flex justify-between items-center mt-2">
              <aside className="error-details__abi-modal shrink-0">
                <ABIModal abi={error.abi} name={error.name} />
              </aside>
              <aside className="error-details__selector shrink-0">
                <Selector selector={error.errorSelector} />
              </aside>
            </footer>
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
