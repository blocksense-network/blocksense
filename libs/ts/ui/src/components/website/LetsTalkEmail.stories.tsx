import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LetsTalkEmail } from './LetsTalkEmail';

const meta = {
  component: LetsTalkEmail,
  title: 'Components/Website/LetsTalkEmail',
} satisfies Meta<typeof LetsTalkEmail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    name: 'Radoslav',
  },
};
