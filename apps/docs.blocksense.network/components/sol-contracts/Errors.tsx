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
        className="contract-item-wrapper__error w-full space-y-4"
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
                  titleLevel={isFromSourceUnit ? 5 : 6}
                />
                <Selector selector={error.errorSelector} />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''}`}
              >
                <Signature signature={error.signature} />
                <ABIModal abi={error.abi} name={error.name} />
                <NatSpec natspec={error.natspec} />
                <Parameters
                  parentTitle={error.name}
                  parameters={error._parameters}
                  titleLevel={isFromSourceUnit ? 4 : 5}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
