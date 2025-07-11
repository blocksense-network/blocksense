import React from 'react';
import { TailwindTest } from './TailwindTest';

export default {
  title: 'Components/TailwindTest',
  component: TailwindTest,
};

export const Default = () => {
  return <TailwindTest text="Tailwind is working!" />;
};

Default.parameters = {
  design: {
    type: 'figma',
    url: 'https://www.figma.com/design/yvE4RWIUfOzb8Y2P2JUbtv/Blocksense-Website?node-id=4235-1171&m=dev',
  },
};

export const CustomText = () => {
  return <TailwindTest text="Custom styled text" />;
};
