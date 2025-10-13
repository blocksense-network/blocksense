import type { ModifierDocItem } from '@blocksense/sol-reflector';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Signature } from '@/sol-contracts-components/Signature';

type ModifiersProps = {
  modifiers?: ModifierDocItem[];
};

export const Modifiers = ({ modifiers = [] }: ModifiersProps) => {
  return (
    <ContractItemWrapper
      title="Modifiers"
      titleLevel={3}
      nonEmpty={!!modifiers.length}
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
