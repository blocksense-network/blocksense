import React from 'react';
import { Badge } from '@/components/ui/badge';

import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <div className="mt-4 bg-white text-black">
          <span className="text-xl font-semibold text-gray-800">Natspec</span>
          <hr class="h-px mt-2 mb-0 bg-gray-200 border-0" />
          <br />
          {natspec.author && (
            <h3 variant="descriptive" className="text-xl font-semibold mb-1">
              {natspec.author}
            </h3>
          )}
          {natspec.notice && (
            <span className="text-base mb-2 font-bold">{natspec.notice}</span>
          )}
          {natspec.dev && (
            <div className="text-base text-slate-600 mb-2">
              {natspec.dev
                .replace(/\n/g, ' ')
                .replace(/{/g, '`{`')
                .replace(/}/g, '`}`')}
            </div>
          )}
          {natspec.params?.map((param, index) => (
            <div key={index} className="mb-5 mt-4">
              <span className="text-base text-slate-600 font-bold">
                {param.name}:
              </span>{' '}
              <span className="text-base text-slate-600">
                {param.description}
              </span>
            </div>
          ))}
          {natspec.returns?.map((ret, index) => (
            <div key={index} className="mb-5">
              <span className="text-base font-semibold">{ret.name}:</span>{' '}
              <span className="text-base text-slate-600">
                {ret.description}
              </span>
            </div>
          ))}
          {Object.entries(natspec.custom || {}).map(([key, value], index) => (
            <div key={index} className="mb-5">
              <span className="text-base font-semibold">{key}:</span>{' '}
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
