import React from 'react';

import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <div>
          <span>NatSpec</span>
          {natspec.title && <h3>{natspec.title}</h3>}
          {natspec.author && <h3>{natspec.author}</h3>}
          {natspec.notice && <span>{natspec.notice}</span>}
          {natspec.dev && (
            <div>
              {natspec.dev
                .replace(/\n/g, ' ')
                .replace(/{/g, '`{`')
                .replace(/}/g, '`}`')}
            </div>
          )}
          {natspec.params?.map((param, index) => (
            <div key={index} className="mb-5">
              <span>{param.name}</span>
              <span>{param.description}</span>
            </div>
          ))}
          {natspec.returns?.map((ret, index) => (
            <div key={index} className="mb-5">
              <span>{ret.name}</span>
              <span>{ret.description}</span>
            </div>
          ))}
          {Object.entries(natspec.custom || {}).map(([key, value], index) => (
            <div key={index} className="mb-5">
              <span>{key}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
