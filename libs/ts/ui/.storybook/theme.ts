import { create } from 'storybook/theming';

import { links } from '../src/constants/links';

export default create({
  base: 'dark',

  // Typography
  fontBase: '"Geist", sans-serif',
  fontCode: 'monospace',

  // Brand
  brandTitle: 'Blocksense Network',
  brandUrl: links.website.home,
  brandImage: '/brand.svg',
  brandTarget: '_target',

  colorPrimary: '#EEFF00',
  colorSecondary: '#484848',

  // UI
  appBg: '#1F1F1F',
  appContentBg: '#171717',
  appPreviewBg: '#171717',
  appBorderColor: '#484848',
  appBorderRadius: 20,

  // Text colors
  textColor: '#F4F3F3',
  textInverseColor: '#171717',
  textMutedColor: '#FFFFFF',

  // Toolbar default and active colors
  barTextColor: '#D2D2D2',
  barSelectedColor: '#EEFF00',
  barHoverColor: '#EEFF00',
  barBg: '#2B2929',

  // Form colors
  inputBg: '#171717',
  inputBorder: '#484848',
  inputTextColor: '#F4F3F3',
  inputBorderRadius: 8,

  buttonBg: '#2C2C2C',
  buttonBorder: '#484848',
  booleanBg: '#2C2C2C',
  booleanSelectedBg: '#171717',
});
