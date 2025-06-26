import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Label } from './Label';

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
  argTypes: {
    className: { control: 'text' },
    children: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: 'Default Label',
  },
};

export const CustomClassName: Story = {
  args: {
    children: 'Label with Custom Class',
    className: 'text-red-500',
  },
};

export const LabelInBox: Story = {
  args: {
    children: 'Label inside a box',
  },
  decorators: [
    Story => (
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
