import React from 'react';
import { NatSpec as NatSpecType } from '@blocksense/sol-reflector';

type NatSpecProps = {
  natspec: NatSpecType;
};

export const NatSpec = ({ natspec }: NatSpecProps) => {
  return (
    <>
      {Object.keys(natspec).length > 0 && (
        <ol className="relative border-l-2 border-gray-200 dark:border-gray-700">
          {natspec.author && (
            <li className="mb-4">
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                Author
              </h3>
              <p className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                {natspec.author}
              </p>
            </li>
          )}
          {natspec.notice && (
            <li className="mb-4">
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                Notice
              </h3>
              <p className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500 italic">
                {natspec.notice}
              </p>
            </li>
          )}
          {natspec.dev && (
            <li className="mb-4">
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                Developer notes
              </h3>
              <p className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500 italic">
                {natspec.dev}
              </p>
            </li>
          )}
          {Object.entries(natspec.custom || {}).map(([key, value], index) => (
            <li
              className={`ml-4 ${index < Object.keys(natspec.custom || {}).length - 1 ? 'mb-4' : ''}`}
              key={index}
            >
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                {key}
              </h3>
              <p className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500 italic">
                {value}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
};
