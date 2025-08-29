import type { Preview } from '@storybook/nextjs-vite';
import { create } from 'storybook/theming';

import '../src/styles/globals.css';
import theme from './theme';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#171717' },
      },
    },
    layout: 'centered',
    docs: {
      theme: create({
        ...theme,
        appBorderRadius: 8,
      }),
    },
  },
  tags: ['autodocs'],
};

export default preview;
