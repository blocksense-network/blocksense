import type { StoryObj } from '@storybook/nextjs-vite';

import { Logo } from './Logo';

export default {
  title: 'Components/Logo',
  component: Logo,
};

type Story = StoryObj<typeof Logo>;

export const PrimaryWhite: Story = {
  args: {
    type: 'primary',
    color: 'white',
  },
};

export const PrimaryBlack: Story = {
  args: {
    type: 'primary',
    color: 'black',
  },
};

export const PrimaryNeon: Story = {
  args: {
    type: 'primary',
    color: 'neon',
  },
};

export const SecondaryWhite: Story = {
  args: {
    type: 'secondary',
    color: 'white',
  },
};

export const SecondaryBlack: Story = {
  args: {
    type: 'secondary',
    color: 'black',
  },
};

export const SecondaryNeon: Story = {
  args: {
    type: 'secondary',
    color: 'neon',
  },
};

export const LogoMarkWhite: Story = {
  args: {
    type: 'logo-mark',
    color: 'white',
  },
};

export const LogoMarkBlack: Story = {
  args: {
    type: 'logo-mark',
    color: 'black',
  },
};

export const LogoMarkNeon: Story = {
  args: {
    type: 'logo-mark',
    color: 'neon',
  },
};

export const LogoMarkBlackWhite: Story = {
  args: {
    type: 'logo-mark',
    color: 'black-white',
  },
};

export const IconWhite: Story = {
  args: {
    type: 'icon',
    color: 'white',
  },
};

export const IconBlack: Story = {
  args: {
    type: 'icon',
    color: 'black',
  },
};

export const IconNeon: Story = {
  args: {
    type: 'icon',
    color: 'neon',
  },
};

export const IconBlackWhite: Story = {
  args: {
    type: 'icon',
    color: 'black-white',
  },
};
