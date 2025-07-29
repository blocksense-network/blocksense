import type { Preview } from '@storybook/nextjs-vite';
import '../src/styles/globals.css';

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
        light: { name: 'Light', value: '#FFFBFA' },
        dark: { name: 'Dark', value: '#1F1F1F' },
      },
    },
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default preview;
