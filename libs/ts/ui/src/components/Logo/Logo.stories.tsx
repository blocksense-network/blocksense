import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { LogoVariant } from './Logo';
import { Logo } from './Logo';

const meta = {
  component: Logo,
  title: 'Components/Logo',
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/mLzd40iFjBBPTPBhGIfa3z/Brand-Assets?node-id=1-51&p=f&m=dev',
    },
  },
} satisfies Meta<typeof Logo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    variant: 'primary-neon',
    className: '',
    width: 200,
  },
};

type LogoSectionProps = {
  variants: LogoVariant[];
};

const LogoSection = ({ variants }: LogoSectionProps) => (
  <section className="flex align-center justify-center gap-4">
    {variants.map(variant => (
      <article className="flex flex-col items-center" key={variant}>
        <Logo variant={variant} />
        <p>{variant}</p>
      </article>
    ))}
  </section>
);

export const Primary = () => (
  <LogoSection variants={['primary-neon', 'primary-white', 'primary-black']} />
);

export const Secondary = () => (
  <LogoSection
    variants={['secondary-neon', 'secondary-white', 'secondary-black']}
  />
);

export const LogoMark = () => (
  <LogoSection
    variants={[
      'logo-mark-neon',
      'logo-mark-white',
      'logo-mark-black',
      'logo-mark-black-white',
    ]}
  />
);

export const Icon = () => (
  <LogoSection
    variants={['icon-neon', 'icon-white', 'icon-black', 'icon-black-white']}
  />
);
