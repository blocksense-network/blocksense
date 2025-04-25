'use client';

import { ReactNode, useRef } from 'react';

import { Label } from '@blocksense/ui/Label';
import { Switch } from '@blocksense/ui/Switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@blocksense/ui/Accordion';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';

type ContractAccordionProps = {
  elementsNames: string[];
  children: ReactNode[];
};

export const ContractAccordion = ({
  elementsNames,
  children,
}: ContractAccordionProps) => {
  const elementsRef = useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(elementsNames, elementsRef);
  const allExpanded = Object.values(accordionStates).every(Boolean);

  return (
    <section>
      <aside className="flex items-center justify-end py-4">
        <Label htmlFor="expand-collapse-toggle" className="mx-2 font-bold">
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
        value={Object.keys(accordionStates).filter(e => accordionStates[e])}
        ref={elementsRef}
      >
        {elementsNames.map((elementName, index) => {
          return (
            <AccordionItem key={elementName} value={elementName}>
              <AccordionTrigger onClick={() => toggleAccordion(elementName)}>
                <AnchorLinkTitle accordion title={elementName} titleLevel={5} />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[elementName] ? 'expanded' : ''}`}
              >
                {children[index]}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
};
