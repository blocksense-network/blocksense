import { Meta, StoryObj } from '@storybook/react';
import { Icon } from './Icon';
import React from 'react';

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  argTypes: {
    icon: {
      control: 'object',
    },
    className: { control: 'text' },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    color: { control: 'text' },
    onClick: { action: 'clicked' },
    ariaLabel: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

const vectorIcon: { type: 'vector'; src: string } = {
  type: 'vector',
  src: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
};

const imageIcon: { type: 'image'; src: string } = {
  type: 'image',
  src: '/icons/test-icon.png',
};

export const VectorIcon: Story = {
  args: {
    icon: vectorIcon,
    ariaLabel: 'Default Icon',
  },
};

export const ImageIcon: Story = {
  args: {
    icon: imageIcon,
    ariaLabel: 'Image Icon',
  },
};

export const WithClassName: Story = {
  args: {
    icon: vectorIcon,
    className: 'bg-red-500',
    ariaLabel: 'Icon with Custom Class',
  },
};

export const Clickable: Story = {
  args: {
    icon: vectorIcon,
    ariaLabel: 'Clickable Icon',
    onClick: () => alert('Icon clicked!'),
  },
};

export const CustomColor: Story = {
  args: {
    icon: vectorIcon,
    color: 'red',
    ariaLabel: 'Icon with Custom Color',
  },
};

export const DifferentSizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Icon icon={imageIcon} size="xs" ariaLabel="Icon size xs" />
      <Icon icon={imageIcon} size="sm" ariaLabel="Icon size sm" />
      <Icon icon={imageIcon} size="md" ariaLabel="Icon size md" />
      <Icon icon={imageIcon} size="lg" ariaLabel="Icon size lg" />
      <Icon icon={imageIcon} size="xl" ariaLabel="Icon size xl" />
    </div>
  ),
};

export const MissingImageSource: Story = {
  args: {
    icon: { type: 'image', src: '/images/missing' },
    ariaLabel: 'Could not find icon',
  },
};
