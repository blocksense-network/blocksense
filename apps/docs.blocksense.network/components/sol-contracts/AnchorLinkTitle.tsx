import React, { createElement } from 'react';

type AnchorLinkTitleProps = {
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  accordion?: boolean;
};

const titleStyles = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-lg',
  6: 'text-xxs sm:text-xs lg:text-base',
};

const accordionStyles = 'text-gray-900';

const borderStyles =
  'nx-border-b nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400';

export const AnchorLinkTitle = ({
  title,
  titleLevel,
  accordion,
}: AnchorLinkTitleProps) => {
  return (
    titleLevel &&
    createElement(
      `h${titleLevel}`,
      {
        className: `${titleStyles[titleLevel]} ${accordion ? accordionStyles : ''} nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100 nx-mt-4 nx-pb-4 ${accordion ? '' : borderStyles}`,
      },
      <>
        {title}
        <a
          href={`#${title}`}
          id={title}
          className="subheading-anchor"
          aria-label="Permalink for this section"
        ></a>
      </>,
    )
  );
};
