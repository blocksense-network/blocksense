import { Meta, StoryObj } from '@storybook/react';
import IllustrationBox from './IllustrationBox';

const meta: Meta<typeof IllustrationBox> = {
  title: 'Components/IllustrationBox',
  component: IllustrationBox,
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof IllustrationBox>;

export const Default: Story = {
  args: {
    title: 'Sample Title',
    description: 'This is a sample description for the illustration box.',
  },
};

export const Custom: Story = {
  args: {
    title: 'Custom Title',
    description: 'A different text variation for illustration purposes.',
  },
};
