import { Meta, StoryObj } from '@storybook/react';
import { CopyButton } from './CopyButton';

const meta: Meta<typeof CopyButton> = {
  title: 'Components/CopyButton',
  component: CopyButton,
  argTypes: {
    textToCopy: { control: 'text' },
    tooltipPosition: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    copyButtonClasses: { control: 'text' },
    disabled: { control: 'boolean' },
    showTooltip: { control: 'boolean' },
    background: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {
  args: {
    textToCopy: 'Text to copy',
  },
};

export const Disabled: Story = {
  args: {
    textToCopy: 'Text to copy',
    disabled: true,
  },
};

export const NoTooltip: Story = {
  args: {
    textToCopy: 'Text to copy',
    showTooltip: false,
  },
};

export const NoBackground: Story = {
  args: {
    textToCopy: 'Text to copy',
    background: false,
  },
};

export const CustomTooltipPosition: Story = {
  args: {
    textToCopy: 'Text to copy',
    tooltipPosition: 'right',
  },
};
