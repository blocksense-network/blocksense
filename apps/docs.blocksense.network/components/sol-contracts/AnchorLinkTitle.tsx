import React, { createElement } from 'react';

type AnchorLinkTitleProps = {
  title?: string;
  parentTitle?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  accordion?: boolean;
};

const titleStyles = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-md max-w-[280px] px-4 sm:max-w-none sm:whitespace-normal sm:overflow-visible truncate sm:truncate-none',
  6: 'text-sm px-4',
};

const accordionStyles = 'text-gray-900';

const borderStyles =
  'nx-border-b nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400';

export const AnchorLinkTitle = ({
  title,
  parentTitle,
  titleLevel,
  accordion,
}: AnchorLinkTitleProps) => {
  return (
    titleLevel &&
    createElement(
      `h${titleLevel}`,
      {
        className: `${titleStyles[titleLevel]} ${accordion ? accordionStyles : ''} nx-font-semibold nx-text-slate-900 dark:nx-text-slate-100 py-4 ${accordion ? '' : borderStyles}`,
      },
      <>
        {title}
        <a
          href={`#${parentTitle ? `${parentTitle}-` : ''}${title}`}
          id={`${parentTitle ? `${parentTitle}-` : ''}${title}`}
          className="subheading-anchor"
          aria-label="Permalink for this section"
        ></a>
      </>,
    )
  );
};
