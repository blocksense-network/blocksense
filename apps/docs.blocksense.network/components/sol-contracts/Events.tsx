import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { EventDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { ABIModal } from './ABIModal/ABIModal';

type EventsProps = {
  events?: EventDocItem[];
};

const getEventNames = (events: EventDocItem[] = []) => {
  return events.map((event, index) => event.name || `event-${index}`) || [];
};

export const Events = ({ events }: EventsProps) => {
  const elementsRef = React.useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getEventNames(events), elementsRef);

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      title="Events"
      titleLevel={3}
      itemsLength={events?.length}
    >
      <aside className="flex items-center justify-end mt-4 mb-4">
        <Label htmlFor="expand-collapse-toggle" className="mr-2 ml-2 font-bold">
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </Label>
        <Switch
          id="expand-collapse-toggle"
          checked={allExpanded}
          onCheckedChange={checked => (checked ? expandAll() : collapseAll())}
        />
      </aside>
      <Accordion
        type="multiple"
        value={Object.keys(accordionStates).filter(k => accordionStates[k])}
        className="contract-item-wrapper__event w-full space-y-4"
        ref={elementsRef}
      >
        {events?.map((event, index) => {
          const id = event.name || `event-${index}`;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={event.name || `Event ${index + 1}`}
                  titleLevel={6}
                />
                <Selector selector={event.eventSelector} />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''}`}
              >
                <Signature signature={event.signature} />
                <ABIModal abi={event.abi} name={event.name} />
                <span className="contract-item-wrapper__event-anonymous">
                  Anonymous: {event.anonymous.toString()}
                </span>
                <NatSpec natspec={event.natspec} />
                <Parameters
                  parentTitle={event.name}
                  parameters={event._parameters}
                  columns={['type', 'name', 'indexed', 'description']}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
