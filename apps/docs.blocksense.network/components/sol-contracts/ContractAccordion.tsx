'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@blocksense/docs-ui/Accordion';
import { Label } from '@blocksense/docs-ui/Label';
import { Switch } from '@blocksense/docs-ui/Switch';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type ContractAccordionProps = {
  elementsNames: string[];
  children: ReactNode[];
};

export const ContractAccordion = ({
  children,
  elementsNames,
}: ContractAccordionProps) => {
  const elementsRef = useRef<HTMLDivElement>(null);
  const { accordionStates, collapseAll, expandAll, toggleAccordion } =
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
