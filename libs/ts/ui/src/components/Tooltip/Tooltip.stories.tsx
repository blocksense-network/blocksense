import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Tooltip } from './Tooltip';

const positions = ['top', 'left', 'right', 'bottom'] as const;
const styles = [
  '',
  'bg-gray-900 text-white',
  'bg-amber-600 border-4 border-neutral-300 rounded-3xl border-double border-rose-500',
  'bg-teal-950 text-cyan-100 rounded-3xl rounded-r-lg italic',
];

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  title: 'Components/Tooltip',
  argTypes: {
    position: {
      control: { type: 'select' },
      options: ['top', 'right', 'bottom', 'left'],
    },
    contentClassName: { control: 'text' },
  },

  render: () => (
    <div className="p-8 bg-background">
      <h1 className="text-3xl font-bold mb-6">Tooltip Storybook</h1>
      <div className="grid grid-cols-2 gap-8">
        {positions.map(position => (
          <div key={position} className="p-6">
            <h2 className="text-xl font-semibold mb-4 capitalize">
              {position} Tooltips
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {styles.map((style, index) => (
                <Tooltip key={index} position={position} contentClassName={style}>
                  <Tooltip.Content>Tooltip works!</Tooltip.Content>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded">
                    hover
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

type Story = StoryObj<typeof Tooltip>;

export const Default = {};

export default meta;
