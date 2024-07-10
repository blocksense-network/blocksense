import React, { ReactNode, createElement } from 'react';

type ContractItemWrapperProps = {
  itemsLength: number | undefined;
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
};

const titleStyles = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-lg',
  6: 'text-base',
};

export const ContractItemWrapper = ({
  itemsLength,
  title,
  titleLevel,
  children,
}: ContractItemWrapperProps) => {
  return (
    Boolean(itemsLength) && (
      <div className="contract-item-wrapper mt-6">
        {titleLevel &&
          createElement(
            `h${titleLevel}`,
            {
              className: `${titleStyles[titleLevel]} nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100 nx-mt-10 nx-border-b nx-pb-1 nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400`,
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
          )}
        <div className="contract-item-wrapper__content">{children}</div>
      </div>
    )
  );
};
