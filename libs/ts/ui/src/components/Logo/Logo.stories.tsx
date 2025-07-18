import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Logo, LogoVariant } from './Logo';

const meta = {
  component: Logo,
} satisfies Meta<typeof Logo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    variant: 'primary-neon',
    className: '',
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
