import React from 'react';

import { VariableDocItem } from '@blocksense/sol-reflector';

import { Variable } from '@/sol-contracts-components/Variable';

type FunctionParametersProps = {
  functionParameters?: VariableDocItem[];
  isReturnParameters?: boolean;
};

export const FunctionParameters = ({
  functionParameters,
  isReturnParameters,
}: FunctionParametersProps) => {
  return (
    <>
      {functionParameters && functionParameters.length > 0 && (
        <>
          <h4>{isReturnParameters ? 'Return Parameters' : 'Parameters'}</h4>
          {functionParameters.map((functionParameter, index) => (
            <Variable key={index} variable={functionParameter} />
          ))}
        </>
      )}
    </>
  );
};
