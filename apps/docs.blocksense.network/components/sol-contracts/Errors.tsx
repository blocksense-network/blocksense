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

import { ErrorDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { ABIModal } from './ABIModal/ABIModal';

type ErrorsProps = {
  errors?: ErrorDocItem[];
  isFromSourceUnit?: boolean;
};

const getErrorNames = (errors: ErrorDocItem[] = []) => {
  return errors.map((error, index) => error.name || `error-${index}`) || [];
};

export const Errors = ({ errors, isFromSourceUnit }: ErrorsProps) => {
  const elementsRef = React.useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getErrorNames(errors), elementsRef);

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      title="Errors"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={errors?.length}
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
        className="contract-item-wrapper__error w-full"
        ref={elementsRef}
      >
        {errors?.map((error, index) => {
          const id = error.name || `error-${index}`;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={error.name || `Error ${index + 1}`}
                  titleLevel={isFromSourceUnit ? 4 : 5}
                />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''} p-2 sm:p-4 border-b border-gray-200`}
              >
                <section className="error-details__signature mb-4">
                  <Signature signature={error.signature} />
                </section>

                <section className="error-details__natspec mb-4">
                  <NatSpec natspec={error.natspec} />
                </section>

                {error._parameters && error._parameters.length > 0 && (
                  <section className="error-details__parameters mb-4">
                    <Parameters
                      parameters={error._parameters}
                      parentTitle={error.name || `Error ${index + 1}`}
                      title="Parameters"
                      titleLevel={isFromSourceUnit ? 5 : 6}
                      columns={['type', 'name', 'dataLocation', 'description']}
                    />
                  </section>
                )}

                <footer className="error-details__footer flex justify-between items-center mt-2">
                  <aside className="error-details__abi-modal flex-shrink-0">
                    <ABIModal abi={error.abi} name={error.name} />
                  </aside>
                  <aside className="error-details__selector flex-shrink-0">
                    <Selector selector={error.errorSelector} />
                  </aside>
                </footer>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
