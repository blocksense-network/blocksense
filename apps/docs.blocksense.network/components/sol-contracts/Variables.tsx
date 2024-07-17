import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { VariableDocItem } from '@blocksense/sol-reflector';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useHashChange } from '@/hooks/useHashChange';

type VariablesProps = {
  variables?: VariableDocItem[];
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

export const Variables = ({ variables, title, titleLevel }: VariablesProps) => {
  const { expanded, setExpanded } = useHashChange();

  return (
    <ContractItemWrapper
      itemsLength={variables?.length}
      title={title}
      titleLevel={titleLevel}
    >
      {variables?.map((variable, index) => {
        const id = variable.name || `variable-${index}`;
        return (
          <Accordion
            type="single"
            collapsible
            className="contract-item-wrapper__variable w-full space-y-4"
            key={index}
            value={expanded === id ? id : undefined}
            onValueChange={value => setExpanded(value)}
          >
            <AccordionItem value={id} id={id}>
              <AccordionTrigger>
                <AnchorLinkTitle
                  accordion={true}
                  title={variable.name ? variable.name : 'unnamed'}
                  titleLevel={6}
                />
              </AccordionTrigger>
              <AccordionContent id={id}>
                <Badge className="contract-item-wrapper__variable-mutability">
                  <span>Mutability: {variable.mutability}</span>
                </Badge>
                <Signature signature={variable.signature} />
                <NatSpec natspec={variable.natspec} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </ContractItemWrapper>
  );
};
