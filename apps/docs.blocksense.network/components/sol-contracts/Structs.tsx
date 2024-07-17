import React, { useEffect, useState } from 'react';
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

type StructsProps = {
  structs?: StructDocItem[];
  isFromSourceUnit?: boolean;
};

export const Structs = ({ structs, isFromSourceUnit }: StructsProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1).trim());

      if (hash) {
        setExpanded(prevExpanded => {
          if (prevExpanded === hash) return prevExpanded;
          return hash;
        });

        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        setExpanded(null);
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

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
