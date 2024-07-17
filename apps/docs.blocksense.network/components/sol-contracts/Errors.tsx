import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ErrorDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useHashChange } from '@/hooks/useHashChange';

type ErrorsProps = {
  errors?: ErrorDocItem[];
  isFromSourceUnit?: boolean;
};

export const Errors = ({ errors, isFromSourceUnit }: ErrorsProps) => {
  const { expanded, setExpanded } = useHashChange();

  return (
    <ContractItemWrapper
      title="Errors"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={errors?.length}
    >
      {errors?.map((error, index) => {
        const id = error.name || `error-${index}`;
        return (
          <Accordion
            type="single"
            collapsible
            className="contract-item-wrapper__error w-full space-y-4"
            key={index}
            value={expanded === id ? id : undefined}
            onValueChange={value => setExpanded(value)}
          >
            <AccordionItem value={id} id={id}>
              <AccordionTrigger>
                <AnchorLinkTitle
                  accordion={true}
                  title={error.name}
                  titleLevel={isFromSourceUnit ? 5 : 6}
                />
              </AccordionTrigger>
              <AccordionContent id={id}>
                <Selector selector={error.errorSelector} />
                <Signature signature={error.signature} />
                <NatSpec natspec={error.natspec} />
                <Variables
                  variables={error?._parameters}
                  title="Parameters"
                  titleLevel={isFromSourceUnit ? 4 : 5}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </ContractItemWrapper>
  );
};
