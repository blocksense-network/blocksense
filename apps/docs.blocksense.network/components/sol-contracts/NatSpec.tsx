import React from 'react';

import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

import { NatSpecItem } from '@/sol-contracts-components/NatSpecItem';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <ol className="relative">
          <NatSpecItem title="Author" content={natspec.author} />
          <NatSpecItem title="Notice" content={natspec.notice} />
          <NatSpecItem title="Developer notes" content={natspec.dev} />
          {Object.entries(natspec.custom || {}).map(([key, value], index) => (
            <NatSpecItem key={index} title={key} content={value} />
          ))}
        </ol>
      )}
    </>
  );
};
