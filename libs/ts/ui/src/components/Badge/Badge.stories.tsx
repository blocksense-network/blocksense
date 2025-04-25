import { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'highlight', 'accentary', 'danger', 'outline'],
    },
    children: { control: 'text' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Badge',
  },
};

export const Highlight: Story = {
  args: {
    variant: 'highlight',
    children: 'Highlight Badge',
  },
};

export const Accentary: Story = {
  args: {
    variant: 'accentary',
    children: 'Accentary Badge',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Badge',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Badge',
  },
};
