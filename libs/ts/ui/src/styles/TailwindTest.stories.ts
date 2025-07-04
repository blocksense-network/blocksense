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
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/yvE4RWIUfOzb8Y2P2JUbtv/Blocksense-Website?node-id=4235-1171&m=dev',
    },
  },
};

export const CustomText: Story = {
  args: {
    text: 'Custom styled text',
  },
};
