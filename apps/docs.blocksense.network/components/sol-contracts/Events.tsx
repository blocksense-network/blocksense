import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { EventDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type EventsProps = {
  events?: EventDocItem[];
};

export const Events = ({ events }: EventsProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1).trim());

      if (hash) {
        setExpanded(prevExpanded => {
          if (prevExpanded === hash) return prevExpanded;
          return hash;
        });

        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        setExpanded(null);
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return (
    <ContractItemWrapper
      title="Events"
      titleLevel={3}
      itemsLength={events?.length}
    >
      {events?.map((event, index) => {
        const id = event.name || `event-${index}`;
        return (
          <Accordion
            type="single"
            collapsible
            className="contract-item-wrapper__event w-full space-y-4"
            key={index}
            value={expanded === id ? id : undefined}
            onValueChange={value => setExpanded(value)}
          >
            <AccordionItem value={id} id={id}>
              <AccordionTrigger>
                <AnchorLinkTitle
                  accordion={true}
                  title={event.name}
                  titleLevel={6}
                />
              </AccordionTrigger>
              <AccordionContent id={id}>
                <Selector selector={event.eventSelector} />
                <Signature signature={event.signature} />
                <span className="contract-item-wrapper__event-anonymous">
                  Anonymous: {event.anonymous.toString()}
                </span>
                <NatSpec natspec={event.natspec} />
                <Variables
                  variables={event?._parameters}
                  title="Parameters"
                  titleLevel={4}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </ContractItemWrapper>
  );
};
