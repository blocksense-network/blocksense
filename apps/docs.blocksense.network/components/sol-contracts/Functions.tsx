import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { Selector } from '@/sol-contracts-components/Selector';
import { Badge } from '@/components/ui/badge';
import { FunctionDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';

type FunctionsProps = {
  functions?: FunctionDocItem[];
  isFromSourceUnit?: boolean;
};

const getNames = (functions: FunctionDocItem[] = []) => {
  return functions.map(_function => _function.name || _function.kind) || [];
};

export const Functions = ({ functions, isFromSourceUnit }: FunctionsProps) => {
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getNames(functions));

  const allExpanded = Object.values(accordionStates).every(
    accordion => accordion === true,
  );

  return (
    <ContractItemWrapper
      title="Functions"
      titleLevel={isFromSourceUnit ? 2 : 3}
      itemsLength={functions?.length}
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
        className="contract-item-wrapper__function w-full space-y-4"
      >
        {functions?.map(_function => {
          const id = _function.name || _function.kind;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={_function.name || _function.kind}
                  titleLevel={isFromSourceUnit ? 5 : 6}
                />
                <Selector selector={_function.functionSelector} />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''}`}
              >
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
                <Parameters
                  parameters={_function._parameters}
                  titleLevel={isFromSourceUnit ? 4 : 5}
                  columns={['type', 'name', 'dataLocation', 'description']}
                />
                <Parameters
                  parameters={_function._returnParameters}
                  title="Return Parameters"
                  titleLevel={isFromSourceUnit ? 4 : 5}
                  columns={['type', 'name', 'dataLocation', 'description']}
                />
                <FunctionModifiers functionModifiers={_function._modifiers} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ContractItemWrapper>
  );
};
