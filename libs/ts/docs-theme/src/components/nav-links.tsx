import cn from 'clsx';
import { ArrowRightIcon } from 'nextra/icons';
import type { Item } from 'nextra/normalize-pages';
import type { ReactElement } from 'react';
import { useConfig } from '../contexts';
import type { DocsThemeConfig } from '../index';
import { Anchor } from './anchor';

interface NavLinkProps {
  currentIndex: number;
  flatDirectories: Item[];
}

const classes = {
  link: cn(
    'nx-flex nx-max-w-[50%] nx-items-center nx-gap-1 nx-py-4 nx-text-sm nx-transition-colors [word-break:break-word] nx-font-semibold',
  ),
  icon: cn('nx-inline nx-h-5 nx-shrink-0'),
};

export const NavLinks = ({
  flatDirectories,
  currentIndex,
}: NavLinkProps): ReactElement | null => {
  const config = useConfig();
  const nav = config.navigation;
  const navigation: Exclude<DocsThemeConfig['navigation'], boolean> =
    typeof nav === 'boolean' ? { prev: nav, next: nav } : nav;
  let prev = navigation.prev && flatDirectories[currentIndex - 1];
  let next = navigation.next && flatDirectories[currentIndex + 1];

  if (prev && !prev.isUnderCurrentDocsTree) prev = false;
  if (next && !next.isUnderCurrentDocsTree) next = false;

  if (!prev && !next) return null;

  return (
    <div
      className={cn(
        'bottom-nav nx-mx-0 sm:nx-mx-1 nx-flex nx-items-center nx-border-n nx-pt-8 dark:nx-border-neutral-800',
        'contrast-more:nx-border-neutral-400 dark:contrast-more:nx-border-neutral-400',
        'print:nx-hidden',
      )}
    >
      {prev && (
        <Anchor
          href={prev.route}
          className={cn(
            classes.link,
            'ltr:nx-mr-auto ltr:nx-pr-4 rtl:nx-pl-4 rtl:nx-mr-auto nx-whitespace-nowrap hover:nx-text-blue-900',
          )}
        >
          <ArrowRightIcon className={cn(classes.icon, 'ltr:nx-rotate-180')} />
          <span className="nx-block nx-text-sm nx-font-semibold hover:nx-text-blue-900">
            {prev.title}
          </span>
        </Anchor>
      )}
      {next && (
        <Anchor
          href={next.route}
          className={cn(
            classes.link,
            'ltr:nx-ml-auto ltr:nx-pl-4 ltr:nx-text-right rtl:nx-mr-auto nx-whitespace-nowrap rtl:nx-pr-4 rtl:nx-text-left nx-text-blue-900 hover:nx-text-black',
          )}
        >
          <span className="nx-block nx-text-sm nx-font-semibold nx-text-black hover:nx-text-blue-900">
            {next.title}
          </span>
          <ArrowRightIcon className={cn(classes.icon, 'rtl:nx-rotate-180')} />
        </Anchor>
      )}
    </div>
  );
};
