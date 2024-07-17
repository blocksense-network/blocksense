import React, { useEffect, useState } from 'react';
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

type ErrorsProps = {
  errors?: ErrorDocItem[];
  isFromSourceUnit?: boolean;
};

export const Errors = ({ errors, isFromSourceUnit }: ErrorsProps) => {
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
