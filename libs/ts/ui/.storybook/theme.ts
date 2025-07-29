import { create } from 'storybook/theming';

export default create({
  base: 'dark',

  fontBase: '"Geist", sans-serif',
  fontCode: 'monospace',

  brandTitle: 'Blocksense Network',
  brandUrl: 'https://blocksense.network',
  brandImage: '/images/primary-black.svg',
  brandTarget: '_target',

  // Colors
  colorPrimary: '#EEFF00', // Blocksense Yellow
  colorSecondary: '#1A57FF', // Blocksense Blue

  // UI
  appBg: '#262626', // Sidebar background (Neutral 1000)
  appContentBg: '#2C2C2C', // Main content background (Neutral 900)
  appBorderColor: '#484848', // Border color (Neutral 750)
  appBorderRadius: 4,

  // Text colors
  textColor: '#FFFBFA', // Blocksense White
  textInverseColor: '#1F1F1F', // Blocksense Black

  // Toolbar default and active colors
  barTextColor: '#D2D2D2', // Neutral 125
  barSelectedColor: '#EEFF00', // Blocksense Yellow
  barBg: '#333333', // Neutral 850

  // Form colors
  inputBg: '#3A3A3A', // Neutral 800
  inputBorder: '#5D5D5D', // Neutral 650
  inputTextColor: '#FFFBFA', // Blocksense White
  inputBorderRadius: 4,
});
