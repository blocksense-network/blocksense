import React from 'react';

import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <div className="natspec px-4 py-4 mb-4 border-solid border border-slate-200 bg-slate-50 rounded-lg text-black">
          <p className="natspec__title text-lg font-semibold text-slate-600">
            Description
          </p>
          <br />
          {natspec.author && (
            <h3 className="natspec__author text-xl mb-1  text-slate-600">
              {natspec.author}
            </h3>
          )}
          {natspec.notice && (
            <p className="natspec__notice mb-4 text-slate-600">
              {natspec.notice}
            </p>
          )}
          {natspec.dev && (
            <div className="natspec__dev  text-slate-600 mb-6">
              {natspec.dev}
            </div>
          )}
          {natspec.params?.map((param, index) => (
            <div className="natspec__param" key={index}>
              <span className="natspec__param-name text-base text-slate-600 font-bold">
                {param.name || 'unnamed'}:
              </span>{' '}
              <span className="natspec__param-description text-base  text-slate-600">
                {param.description}
              </span>
            </div>
          ))}
          {natspec.returns?.map((ret, index) => (
            <div className="natspec__return" key={index}>
              <span className="natspec__return-name text-base font-semibold">
                {ret.name || 'unnamed'}:
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
