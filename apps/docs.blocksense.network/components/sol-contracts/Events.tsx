import type { EventDocItem } from '@blocksense/sol-reflector';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Signature } from '@/sol-contracts-components/Signature';

type EventsProps = {
  events?: EventDocItem[];
};

export const Events = ({ events = [] }: EventsProps) => {
  return (
    <ContractItemWrapper
      title="Events"
      titleLevel={3}
      nonEmpty={!!events.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(events)}>
        {events.map(event => (
          <section key={event.name} className="event-details__container">
            <section className="event-details__signature">
              <Signature signature={event.signature} />
            </section>
            <section className="event-details__natspec mb-4">
              <NatSpec natspec={event.natspec} />
            </section>
            {event._parameters && event._parameters.length > 0 && (
              <section className="event-details__parameters mb-4">
                <Parameters
                  parentTitle={event.name}
                  parameters={event._parameters}
                  columns={['type', 'name', 'indexed', 'description']}
                  titleLevel={6}
                />
              </section>
            )}
            <section className="event-details__anonymous">
              <span className="font-semibold">Anonymous:</span>{' '}
              {event.anonymous.toString()}
            </section>
            <footer className="event-details__footer flex justify-between items-center mt-2">
              <aside className="event-details__abi-modal shrink-0">
                <ABIModal abi={event.abi} name={event.name} />
              </aside>
            </footer>
          </section>
        ))}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
