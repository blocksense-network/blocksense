import type { VariableDocItem } from '@blocksense/sol-reflector';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { Signature } from '@/sol-contracts-components/Signature';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

export const Variables = ({
  title,
  titleLevel,
  variables = [],
}: VariablesProps) => {
  return (
    <ContractItemWrapper
      nonEmpty={!!variables.length}
      title={title}
      titleLevel={titleLevel}
    >
      <ContractAccordion elementsNames={getContractElementsNames(variables)}>
        {variables.map(variable => (
          <section key={variable.name} className="variable-details__container">
            <section className="variable-details__signature mb-4">
              <Signature signature={variable.signature} />
            </section>
            <section className="variable-details__natspec">
              <NatSpec natspec={variable.natspec} />
            </section>
            <footer className="variable-details__footer flex justify-between items-center mt-2">
              <aside className="variable-details__abi-modal shrink-0">
                <ABIModal abi={variable.abi!} name={variable.name} />
              </aside>
            </footer>
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
