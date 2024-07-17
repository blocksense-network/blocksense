import React, { createElement } from 'react';

type AnchorLinkTitleProps = {
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

const titleStyles = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-lg',
  6: 'text-base',
};

export const AnchorLinkTitle = ({
  title,
  titleLevel,
}: AnchorLinkTitleProps) => {
  return (
    titleLevel &&
    createElement(
      `h${titleLevel}`,
      {
        className: `${titleStyles[titleLevel]} nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100 nx-mt-4 nx-border-b nx-pb-4 nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400`,
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
