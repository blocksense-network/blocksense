import React from 'react';

import { InfoTip } from './InfoTip';

export default {
  title: 'Components/InfoTip',
  component: InfoTip,
};

export const Default = () => <InfoTip position="top">More info</InfoTip>;

export const Positions = () => {
  const positions: Array<'top' | 'right' | 'bottom' | 'left'> = [
    'top',
    'right',
    'bottom',
    'left',
  ];

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      {positions.map(position => (
        <div key={position} className="flex flex-col items-center gap-2">
          <h2 className="text-lg capitalize">{position}</h2>
          <InfoTip position={position}>{`InfoTip on ${position}`}</InfoTip>
        </div>
      ))}
    </div>
  );
};

export const CustomizedContentStyle = () => (
  <InfoTip
    position="bottom"
    contentClassName="bg-gray-200 border-2 border-blue-500 rounded-3xl"
  >
    Custom Styled InfoTip!
  </InfoTip>
);

export const InlineText = () => (
  <p>
    Here is some informative text{' '}
    <InfoTip position="top">
      Additional details about this feature that provide further context.
    </InfoTip>{' '}
    to help you understand the concept better.
  </p>
);

export const ContainerWidth = () => (
  <InfoTip position="top" contentClassName="w-[12rem] whitespace-normal">
    Additional details about this feature that provide further context.
  </InfoTip>
);
