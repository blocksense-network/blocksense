import React from 'react';

type NatSpecItemProps = {
  title: string;
  content?: string;
};

export const NatSpecItem = ({ title, content = '' }: NatSpecItemProps) =>
  content && (
    <dd className="mb-4">
      <li>
        <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {content.split('\n').map((line, index) => (
          <p
            key={index}
            className="block mb-1 text-sm font-normal text-gray-500 dark:text-gray-500 italic"
          >
            {line}
          </p>
        ))}
      </li>
    </dd>
  );
