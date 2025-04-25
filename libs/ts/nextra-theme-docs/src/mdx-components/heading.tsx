// TODO: check why isn't optimized
'use no memo';

import cn from 'clsx';
import type { ComponentProps, FC } from 'react';
import { HeadingAnchor } from './heading-anchor.client';

const createHeading = (
  Tag: `h${1 | 2 | 3 | 4 | 5 | 6}`,
): FC<ComponentProps<typeof Tag>> =>
  function Heading({ children, id, className, ...props }) {
    const _class = // can be added by footnotes
      className === 'sr-only'
        ? 'x:sr-only'
        : cn(
            'x:tracking-tight x:text-slate-900 x:dark:text-slate-100',
            Tag === 'h1'
              ? 'x:font-bold'
              : 'x:font-semibold x:target:animate-[fade-in_1.5s]',
            {
              h1: 'h1-mdx x:mt-2',
              h2: 'h2-mdx x:mt-10 x:border-b x:pb-1 nextra-border',
              h3: 'h3-mdx x:mt-8',
              h4: 'h4-mdx x:mt-8',
              h5: 'h5-mdx x:mt-8',
              h6: 'h6-mdx x:mt-8',
            }[Tag],
            className,
          );

    return (
      <Tag id={id} className={_class} {...props}>
        {children}
        {id && <HeadingAnchor id={id} />}
      </Tag>
    );
  };

export const H1 = createHeading('h1');
export const H2 = createHeading('h2');
export const H3 = createHeading('h3');
export const H4 = createHeading('h4');
export const H5 = createHeading('h5');
export const H6 = createHeading('h6');
