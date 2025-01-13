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

import { StructDocItem } from '@blocksense/sol-reflector';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';

type StructsProps = {
  structs?: StructDocItem[];
  isFromSourceUnit?: boolean;
};

const getStructNames = (structs: StructDocItem[] = []) => {
  return structs.map((struct, index) => struct.name || `struct-${index}`) || [];
};

export const Structs = ({ structs, isFromSourceUnit }: StructsProps) => {
  const elementsRef = React.useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getStructNames(structs), elementsRef);

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      title="Structs"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={structs?.length}
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
        className="contract-item-wrapper__struct w-full"
        ref={elementsRef}
      >
        {structs?.map((struct, index) => {
          const id = struct.name || `struct-${index}`;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={struct.name || `Struct ${index + 1}`}
                  titleLevel={isFromSourceUnit ? 4 : 5}
                />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''} p-2 sm:p-4 border-b border-gray-200`}
              >
                <section className="struct-details__visibility">
                  <strong className="mb-1 font-semibold text-gray-900 dark:text-white">
                    Visibility:
                  </strong>
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-500 italic">
                    {struct.visibility}
                  </span>
                </section>

                <section className="struct-details__natspec mt-6 mb-4">
                  <NatSpec natspec={struct.natspec} />
                </section>

                {struct._members && struct._members.length > 0 && (
                  <section className="struct-details__members mb-4">
                    <Parameters
                      parameters={struct._members}
                      parentTitle={struct.name || `Struct ${index + 1}`}
                      title="Members"
                      titleLevel={isFromSourceUnit ? 5 : 6}
                      columns={['type', 'name', 'dataLocation', 'description']}
                    />
                  </section>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
