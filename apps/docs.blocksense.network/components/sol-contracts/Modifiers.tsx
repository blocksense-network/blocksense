import { ModifierDocItem } from '@blocksense/sol-reflector';

import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';

type ModifiersProps = {
  modifiers?: ModifierDocItem[];
};

export const Modifiers = ({ modifiers = [] }: ModifiersProps) => {
  return (
    <ContractItemWrapper
      title="Modifiers"
      titleLevel={3}
      itemsLength={modifiers.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(modifiers)}>
        {modifiers.map(modifier => (
          <section key={modifier.name} className="modifier-details__container">
            <span className="contract-item-wrapper__modifier-visibility">
              Visibility: {modifier.visibility}
            </span>
            <Signature signature={modifier.signature} />
            <NatSpec natspec={modifier.natspec} />
            {modifier._parameters && modifier._parameters.length > 0 && (
              <Parameters
                parentTitle={modifier.name}
                parameters={modifier._parameters}
              />
            )}
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
