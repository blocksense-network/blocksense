'use client';

import { ReactNode, useMemo, useRef } from 'react';

import {
  EnumDocItem,
  ErrorDocItem,
  EventDocItem,
  FunctionDocItem,
  ModifierDocItem,
  StructDocItem,
  VariableDocItem,
} from '@blocksense/sol-reflector';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';

type ContractElements =
  | FunctionDocItem[]
  | VariableDocItem[]
  | ModifierDocItem[]
  | EnumDocItem[]
  | StructDocItem[]
  | EventDocItem[]
  | ErrorDocItem[];

type ContractAccordionProps = {
  elements: ContractElements;
  children: ReactNode[];
};

function getNames(elements: ContractElements) {
  return elements.map(element => {
    if ('kind' in element) {
      return element.name || element.kind;
    }
    return element.name;
  });
}

export const ContractAccordion = ({
  elements,
  children,
}: ContractAccordionProps) => {
  const elementsRef = useRef<HTMLDivElement>(null);
  const elementsNames = useMemo(() => getNames(elements), [elements]);
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
        className="contract-item-wrapper__function w-full"
        ref={elementsRef}
      >
        {elements.map((_, index) => {
          const elementName = elementsNames[index];
          return (
            <AccordionItem key={elementName} value={elementName}>
              <AccordionTrigger onClick={() => toggleAccordion(elementName)}>
                <AnchorLinkTitle accordion title={elementName} titleLevel={5} />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[elementName] ? 'expanded' : ''} p-2 sm:p-4 border-b border-gray-200`}
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
