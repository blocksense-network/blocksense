import React from 'react';

import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <div className="natspec py-2 px-4 mt-2 bg-white text-black">
          <span className="natspec__title text-xl font-semibold text-gray-800">
            Description
          </span>
          <br />
          {natspec.author && (
            <h3 className="natspec__author text-xl mb-1 text-gray-700">
              {natspec.author}
            </h3>
          )}
          {natspec.notice && (
            <span className="natspec__notice mb-2 text-base text-gray-700">
              {natspec.notice}
            </span>
          )}
          {natspec.dev && (
            <div className="natspec__dev text-base  text-slate-600 mb-2">
              {natspec.dev}
            </div>
          )}
          {natspec.params?.map((param, index) => (
            <div className="natspec__param" key={index}>
              <span className="natspec__param-name text-base text-slate-600 font-bold">
                {param.name}:
              </span>{' '}
              <span className="natspec__param-description text-base  text-slate-600">
                {param.description}
              </span>
            </div>
          ))}
          {natspec.returns?.map((ret, index) => (
            <div className="natspec__return mb-5" key={index}>
              <span className="natspec__return-name text-base font-semibold">
                {ret.name}:
              </span>{' '}
              <span className="natspec__return-description text-base text-slate-600">
                {ret.description}
              </span>
            </div>
          ))}
          {Object.entries(natspec.custom || {}).map(([key, value], index) => (
            <div className="natspec__custom mb-5" key={index}>
              <span className="natspec__custom-key text-base font-semibold">
                {key}:
              </span>{' '}
              <span className="natspec__custom-value">{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
