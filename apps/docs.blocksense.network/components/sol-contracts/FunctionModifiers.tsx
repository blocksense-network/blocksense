import React from 'react';

import { FunctionModifierDocItem } from '@blocksense/sol-reflector';

type FunctionModifiersProps = {
  functionModifiers?: FunctionModifierDocItem[];
};

export const FunctionModifiers = ({
  functionModifiers,
}: FunctionModifiersProps) => {
  return (
    <>
      {functionModifiers && functionModifiers.length > 0 && (
        <>
          <h4>Modifiers</h4>
          <div>
            {functionModifiers.map((functionModifier, index) => (
              <div key={index}>
                <span>Modifier Name: {functionModifier._modifierName}</span>
                <span>Kind: {functionModifier.kind}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};
