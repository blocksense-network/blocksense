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
import { FunctionDocItem } from '@blocksense/sol-reflector';
import { Signature } from '@/sol-contracts-components/Signature';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { useExpandCollapse } from '@/hooks/useExpandCollapse';
import { ABIModal } from './ABIModal/ABIModal';

type FunctionsProps = {
  functions?: FunctionDocItem[];
  isFromSourceUnit?: boolean;
};

const getNames = (functions: FunctionDocItem[] = []) => {
  return functions.map(_function => _function.name || _function.kind) || [];
};

export const Functions = ({ functions, isFromSourceUnit }: FunctionsProps) => {
  const elementsRef = React.useRef<HTMLDivElement>(null);
  const { accordionStates, expandAll, collapseAll, toggleAccordion } =
    useExpandCollapse(getNames(functions), elementsRef);

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
        className="contract-item-wrapper__function w-full"
        ref={elementsRef}
      >
        {functions?.map(_function => {
          const id = _function.name || _function.kind;
          return (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger onClick={() => toggleAccordion(id)}>
                <AnchorLinkTitle
                  accordion
                  title={_function.name || _function.kind}
                  titleLevel={isFromSourceUnit ? 4 : 5}
                />
              </AccordionTrigger>
              <AccordionContent
                className={`accordion-content ${accordionStates[id] ? 'expanded' : ''} p-2 sm:p-4 border-b border-gray-200`}
              >
                <section className="function-details__signature">
                  <Signature signature={_function.signature} />
                </section>
                <section className="function-details__natspec mt-6 mb-4">
                  <NatSpec natspec={_function.natspec} />
                </section>

                {_function._parameters && _function._parameters.length > 0 && (
                  <section className="function-details__parameters mb-4">
                    <Parameters
                      parameters={_function._parameters}
                      parentTitle={_function.name || _function.kind}
                      titleLevel={isFromSourceUnit ? 5 : 6}
                      columns={['type', 'name', 'dataLocation', 'description']}
                    />
                  </section>
                )}

                {_function._returnParameters &&
                  _function._returnParameters.length > 0 && (
                    <section className="function-details__return-parameters">
                      <Parameters
                        parameters={_function._returnParameters}
                        title="Return Parameters"
                        parentTitle={_function.name || _function.kind}
                        titleLevel={isFromSourceUnit ? 5 : 6}
                        columns={[
                          'type',
                          'name',
                          'dataLocation',
                          'description',
                        ]}
                      />
                    </section>
                  )}

                <section className="function-details__modifiers">
                  <FunctionModifiers functionModifiers={_function._modifiers} />
                </section>
                <footer className="function-details__footer flex justify-between items-center mt-2">
                  <aside className="function-details__abi-modal flex-shrink-0">
                    <ABIModal abi={_function.abi} name={_function.name} />
                  </aside>
                  <aside className="function-details__selector flex-shrink-0">
                    <Selector selector={_function.functionSelector} />
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
