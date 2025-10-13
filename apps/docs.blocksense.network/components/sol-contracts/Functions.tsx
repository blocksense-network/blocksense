import type { FunctionDocItem } from '@blocksense/sol-reflector';
import { getContractElementsNames } from '@/components/ReferenceDocumentation/SourceUnit';
import { ContractAccordion } from '@/components/sol-contracts/ContractAccordion';
import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { FunctionModifiers } from '@/sol-contracts-components/FunctionModifiers';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { Parameters } from '@/sol-contracts-components/Parameters';
import { Selector } from '@/sol-contracts-components/Selector';
import { Signature } from '@/sol-contracts-components/Signature';

type FunctionsProps = {
  functions?: FunctionDocItem[];
  isFromSourceUnit?: boolean;
};

export const Functions = ({
  functions = [],
  isFromSourceUnit,
}: FunctionsProps) => {
  return (
    <ContractItemWrapper
      title="Functions"
      titleLevel={isFromSourceUnit ? 2 : 3}
      nonEmpty={!!functions.length}
    >
      <ContractAccordion elementsNames={getContractElementsNames(functions)}>
        {functions.map(_function => {
          const functionName = _function.name || _function.kind;
          return (
            <div key={functionName} className="p-4">
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
                    parentTitle={functionName}
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
                      parentTitle={functionName}
                      titleLevel={isFromSourceUnit ? 5 : 6}
                      columns={['type', 'name', 'dataLocation', 'description']}
                    />
                  </section>
                )}
              <section className="function-details__modifiers">
                <FunctionModifiers functionModifiers={_function._modifiers} />
              </section>
              <footer className="function-details__footer flex justify-between items-center mt-2">
                <aside className="function-details__abi-modal shrink-0">
                  <ABIModal abi={_function.abi} name={functionName} />
                </aside>
                <aside className="function-details__selector shrink-0">
                  <Selector selector={_function.functionSelector} />
                </aside>
              </footer>
            </div>
          );
        })}
      </ContractAccordion>
    </ContractItemWrapper>
  );
};
