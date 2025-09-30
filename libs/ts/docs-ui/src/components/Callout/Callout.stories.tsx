import type { Meta, StoryObj } from '@storybook/react';

import { Callout } from './Callout';

const meta: Meta<typeof Callout> = {
  title: 'Components/Callout',
  component: Callout,
  argTypes: {
    type: {
      control: 'select',
      options: ['default', 'error', 'info', 'warning'],
    },
    emoji: {
      control: 'text',
    },
    title: {
      control: 'text',
    },
    children: {
      control: 'text',
    },
    className: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Default: Story = {
  args: {
    type: 'default',
    title: 'Default Callout',
    children: 'This is a default callout message.',
  },
};

export const Info: Story = {
  args: {
    type: 'info',
    title: 'Information',
    children: 'This is an informational message.',
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    title: 'Warning',
    children: 'Be cautious! This is a warning.',
  },
};

export const Error: Story = {
  args: {
    type: 'error',
    title: 'Error',
    children: 'An error has occurred.',
  },
};
