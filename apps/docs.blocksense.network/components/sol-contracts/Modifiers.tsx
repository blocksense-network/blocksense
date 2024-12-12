'use client';
import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Signature } from '@/sol-contracts-components/Signature';
import { ModifierDocItem } from '@blocksense/sol-reflector';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type ModifiersProps = {
  modifiers?: ModifierDocItem[];
};

const getModifierNames = (modifiers: ModifierDocItem[] = []) => {
  return modifiers.map(modifier => modifier.name) || [];
};

export const Modifiers = ({ modifiers }: ModifiersProps) => {
  const elementsRef = React.useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getModifierNames(modifiers), elementsRef);

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      title="Modifiers"
      titleLevel={3}
      itemsLength={modifiers?.length}
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
        className="contract-item-wrapper__modifier w-full"
        ref={elementsRef}
      >
        {modifiers?.map((modifier, index) => {
          const id = modifier.name;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={modifier.name}
                  titleLevel={6}
                />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''}`}
              >
                <span className="contract-item-wrapper__modifier-visibility">
                  Visibility: {modifier.visibility}
                </span>
                <Signature signature={modifier.signature} />
                <NatSpec natspec={modifier.natspec} />
                <Parameters
                  parentTitle={modifier.name}
                  parameters={modifier?._parameters}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
