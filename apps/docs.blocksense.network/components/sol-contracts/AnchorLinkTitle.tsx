import { createElement } from 'react';
import type { HTMLAttributes } from 'react';

type AnchorLinkTitleProps = {
  title?: string;
  parentTitle?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  accordion?: boolean;
  pagefindIgnore?: boolean;
};

const titleStyles = {
  1: 'text-3xl md:text-4xl',
  2: 'text-2xl md:text-3xl',
  3: 'text-xl md:text-2xl font-bold h3__separator',
  4: 'text-lg md:text-base',
  5: 'text-base md:text-sm max-w-[280px] font-bold truncate lg:max-w-none lg:whitespace-normal lg:overflow-visible lg:truncate-none dark:text-white',
  6: 'text-sm',
};

const accordionStyles = 'text-gray-900';

const borderStyles =
  'nx-border-b nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400  py-3';

export const AnchorLinkTitle = ({
  accordion,
  pagefindIgnore = false,
  parentTitle,
  title,
  titleLevel,
}: AnchorLinkTitleProps) => {
  if (!titleLevel) {
    return null;
  }

  const id = `${parentTitle ? `${parentTitle}-` : ''}${title}`;

  const elementAttributes: HTMLAttributes<HTMLHeadingElement> = {
    id,
    className: `${titleStyles[titleLevel]} ${accordion ? accordionStyles : ''} nx-font-semibold nx-text-slate-900 dark:nx-text-slate-100 ${accordion ? '' : borderStyles}`,
    ...(pagefindIgnore && { 'data-pagefind-ignore': true }),
  };

  return createElement(
    `h${titleLevel}`,
    elementAttributes,
    <>
      {title}
      <a
        href={`#${id}`}
        id={id}
        className="subheading-anchor"
        aria-label="Permalink for this section"
      ></a>
    </>,
  );
};
