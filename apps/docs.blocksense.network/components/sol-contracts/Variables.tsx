import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { VariableDocItem } from '@blocksense/sol-reflector';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

const getVariableNames = (variables: VariableDocItem[] = []) => {
  return (
    variables.map((variable, index) => variable.name || `variable-${index}`) ||
    []
  );
};

function getVariableSignature(variable: VariableDocItem): string {
  const signature: string = variable.signature || '';

  if (variable.constant) {
    const signatureParts: string[] = signature.split(' ');

    signatureParts.splice(signatureParts.length - 1, 0, 'constant');
    return signatureParts.join(' ');
  }

  return signature;
}

export const Variables = ({
  variables = [],
  title,
  titleLevel,
}: VariablesProps) => {
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getVariableNames(variables));

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      itemsLength={variables?.length}
      title={title}
      titleLevel={titleLevel}
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
        className="contract-item-wrapper__variable w-full space-y-4"
      >
        {variables?.map((variable, index) => {
          const id = variable.name || `variable-${index}`;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={variable.name ? variable.name : 'unnamed'}
                  titleLevel={6}
                />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''}`}
              >
                <Badge className="contract-item-wrapper__variable-mutability">
                  <span>Mutability: {variable.mutability}</span>
                </Badge>
                <Signature signature={getVariableSignature(variable)} />
                <NatSpec natspec={variable.natspec} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
