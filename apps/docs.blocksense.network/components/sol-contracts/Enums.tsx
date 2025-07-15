import { EnumDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';

type EnumsProps = {
  enums?: EnumDocItem[];
  isFromSourceUnit?: boolean;
};

export const Enums = ({ enums = [], isFromSourceUnit }: EnumsProps) => {
  return (
    <ContractItemWrapper
      title="Enums"
      titleLevel={isFromSourceUnit ? 2 : 3}
      nonEmpty={!!enums.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(enums)}>
        {enums.map(_enum => (
          <section key={_enum.name} className="enum-details__container">
            <section className="enum-details__natspec mt-6 mb-4">
              <NatSpec natspec={_enum.natspec} />
            </section>
            {_enum._members && (
              <section className="enum-details__members mb-4">
                {_enum._members.map(member => (
                  <div className="enum-details__member" key={member}>
                    <span className="enum-details__member-name">{member}</span>
                  </div>
                ))}
              </section>
            )}
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
