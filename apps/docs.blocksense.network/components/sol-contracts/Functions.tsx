import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { FunctionDocItem, FunctionType } from '@blocksense/sol-reflector';

import { Signature } from '@/sol-contracts-components/Signature';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { FunctionParameters } from '@/sol-contracts-components/FunctionParameters';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { useHashChange } from '@/hooks/useHashChange';

type FunctionsProps = {
  functions?: FunctionDocItem[];
  isFromSourceUnit?: boolean;
};

export const Functions = ({ functions, isFromSourceUnit }: FunctionsProps) => {
  const { expanded, setExpanded } = useHashChange();
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(functions);

  useEffect(() => {
    if (expanded) {
      const element = document.getElementById(expanded);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [expanded]);

  const handleAccordionToggle = (id: string) => {
    toggleAccordion(id);
    setExpanded(null);
  };
  const { expanded, setExpanded } = useHashChange();

  return (
    <ContractItemWrapper
      title="Functions"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={functions?.length}
    >
      {functions?.map((_function, index) => (
        <Accordion
          type="single"
          collapsible
          className="contract-item-wrapper__function w-full space-y-4"
          key={index}
        >
          <AccordionItem value="1">
            <AccordionTrigger>
              <AnchorLinkTitle
                accordion={true}
                title={_function.name || _function.kind}
                titleLevel={isFromSourceUnit ? 5 : 6}
              />
            </AccordionTrigger>
            <AccordionContent>
              <Selector selector={_function.functionSelector} />
              <Badge className="contract-item-wrapper__function-kind mb-4">
                <span>Kind: {_function.kind}</span>
              </Badge>
              <Badge className="contract-item-wrapper__function-visibility">
                <span>Visibility: {_function.visibility}</span>
              </Badge>
              <Badge className="contract-item-wrapper__function-state-mutability">
                <span>State Mutability: {_function.stateMutability}</span>
              </Badge>
              <Badge className="contract-item-wrapper__function-virtual">
                <span>Virtual: {_function.virtual.toString()}</span>
              </Badge>
              <Signature signature={_function.signature} />
              <NatSpec natspec={_function.natspec} />
              <Variables
                variables={_function._parameters}
                title="Parameters"
                titleLevel={isFromSourceUnit ? 4 : 5}
              />
              <Variables
                variables={_function._returnParameters}
                title="Return Parameters"
                titleLevel={isFromSourceUnit ? 4 : 5}
              />
              <FunctionModifiers functionModifiers={_function._modifiers} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </ContractItemWrapper>
  );
};
