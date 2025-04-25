import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'action',
        'danger',
        'outline',
        'highlight',
        'transparent',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['base', 'sm', 'md', 'lg', 'xl', 'icon'],
    },
    content: { control: 'text' },
    disabled: { control: 'boolean' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    variant: 'action',
    size: 'base',
    content: 'Click me',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'action',
    size: 'base',
    content: 'Disabled',
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    className: 'bg-red-500',
    variant: 'highlight',
    size: 'md',
    content: 'Warning',
    icon: <img className="w-4 h-4" src="icons/test-icon.png" alt="icon" />,
  },
};

export const LinkButton: Story = {
  args: {
    variant: 'link',
    size: 'base',
    content: 'Go to Google',
    href: 'https://www.google.com',
    target: '_blank',
  },
};
