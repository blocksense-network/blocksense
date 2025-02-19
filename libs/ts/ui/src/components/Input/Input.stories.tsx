import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    variant: {
      control: 'select',
      options: ['outline', 'filled', 'transparent', 'error'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    placeholder: { control: 'text' },
    value: { control: 'text' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
    disabled: { control: 'boolean' },
    className: { control: 'text' },
    icon: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    variant: 'outline',
    size: 'md',
    placeholder: 'Enter text',
  },
};

export const WithError: Story = {
  args: {
    variant: 'error',
    size: 'md',
    placeholder: 'Error input',
    error: true,
    errorMessage: 'Invalid input',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'outline',
    size: 'md',
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    variant: 'outline',
    size: 'md',
    placeholder: 'Search...',
    icon: (
      <span role="img" aria-label="magnifying glass">
        🔍
      </span>
    ),
  },
};
