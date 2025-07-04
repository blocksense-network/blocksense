import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TailwindTest } from './TailwindTest';

const meta: Meta<typeof TailwindTest> = {
  title: 'Test/TailwindTest',
  component: TailwindTest,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    text: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: 'Tailwind is working!',
  },
};

export const CustomText: Story = {
  args: {
    text: 'Custom styled text',
  },
};
