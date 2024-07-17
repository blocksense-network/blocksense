import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { StructDocItem } from '@blocksense/sol-reflector';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { useHashChange } from '@/hooks/useHashChange';

type StructsProps = {
  structs?: StructDocItem[];
  isFromSourceUnit?: boolean;
};

export const Structs = ({ structs, isFromSourceUnit }: StructsProps) => {
  const { expanded, setExpanded } = useHashChange();

  return (
    <ContractItemWrapper
      title="Structs"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={structs?.length}
    >
      {structs?.map((struct, index) => {
        const id = struct.name || `struct-${index}`;
        return (
          <Accordion
            type="single"
            collapsible
            className="contract-item-wrapper__struct w-full space-y-4"
            key={index}
            value={expanded === id ? id : undefined}
            onValueChange={value => setExpanded(value)}
          >
            <AccordionItem value={id} id={id}>
              <AccordionTrigger>
                <AnchorLinkTitle
                  accordion={true}
                  title={struct.name}
                  titleLevel={isFromSourceUnit ? 5 : 6}
                />
              </AccordionTrigger>
              <AccordionContent id={id}>
                <span className="contract-item-wrapper__struct-visibility">
                  Visibility: {struct.visibility}
                </span>
                <NatSpec natspec={struct.natspec} />
                <Variables
                  variables={struct?._members}
                  title="Members"
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
