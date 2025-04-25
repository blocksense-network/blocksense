import { Meta, StoryObj } from '@storybook/react';
import { ImageWrapper } from './ImageWrapper';

const meta: Meta<typeof ImageWrapper> = {
  title: 'Components/ImageWrapper',
  component: ImageWrapper,
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    className: { control: 'text' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof ImageWrapper>;

const randomImage =
  'https://community.softr.io/uploads/db9110/original/2X/7/74e6e7e382d0ff5d7773ca9a87e6f6f8817a68a6.jpeg';

export const Default: Story = {
  args: {
    src: randomImage,
    alt: 'Placeholder Image',
    className: 'w-60 h-40 relative',
  },
};

export const Clickable: Story = {
  args: {
    src: randomImage,
    alt: 'Clickable Image',
    className: 'w-60 h-40 relative cursor-pointer',
    onClick: () => alert('Image clicked!'),
  },
};
