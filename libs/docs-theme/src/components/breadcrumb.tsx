import { useState, ReactElement, Fragment, useEffect } from 'react';
import cn from 'clsx';
import { ArrowRightIcon } from 'nextra/icons';
import type { Item } from 'nextra/normalize-pages';
import { Anchor } from './anchor';
import { Dropdown } from './dropdown';

export function Breadcrumb({
  activePath,
}: {
  activePath: Item[];
}): ReactElement {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(max-width: 639px)');
      setIsMobile(mediaQuery.matches);

      const handleResize = () => setIsMobile(mediaQuery.matches);
      mediaQuery.addEventListener('change', handleResize);

      return () => mediaQuery.removeEventListener('change', handleResize);
    }
  }, []);

  return (
    <div className="nextra-breadcrumb nx-mt-12 nx-flex nx-items-center nx-gap-1 nx-overflow-hidden nx-text-sm">
      {/* Always display the first item */}
      {activePath.length > 0 && (
        <Fragment>
          <div
            className={cn(
              'nx-whitespace-nowrap nx-transition-colors',
              'nx-font-bold nx-text-black contrast-more:nx-font-bold contrast-more:nx-text-current',
            )}
            title={activePath[0].title}
          >
            <Anchor href={activePath[0].route}>{activePath[0].title}</Anchor>
          </div>
          {isMobile && activePath.length > 2 && (
            <Dropdown
              trigger={<span className="nx-cursor-pointer">...</span>}
              className="nx-dropdown-container"
            >
              {activePath.slice(1, -1).map(dropdownItem => (
                <div
                  key={dropdownItem.route + dropdownItem.name}
                  className="nx-dropdown-menu-item"
                >
                  <Anchor href={dropdownItem.route}>
                    {dropdownItem.title}
                  </Anchor>
                </div>
              ))}
            </Dropdown>
          )}
          {!isMobile &&
            activePath.slice(1, -1).map((item, index) => (
              <Fragment key={item.route + item.name}>
                <ArrowRightIcon className="nx-w-3.5 nx-shrink-0" />
                <div
                  className={cn(
                    'nx-whitespace-nowrap nx-transition-colors',
                    'nx-min-w-[24px] nx-overflow-hidden nx-text-ellipsis',
                    'hover:nx-text-gray-900 dark:hover:nx-text-gray-100',
                  )}
                  title={item.title}
                >
                  <Anchor href={item.route}>{item.title}</Anchor>
                </div>
              </Fragment>
            ))}
          {/* Always display the last item */}
          {activePath.length > 1 && (
            <Fragment>
              <ArrowRightIcon className="nx-w-3.5 nx-shrink-0" />
              <div
                className={cn(
                  'nx-whitespace-nowrap nx-transition-colors',
                  'nx-font-bold nx-text-black contrast-more:nx-font-bold contrast-more:nx-text-current',
                )}
                title={activePath[activePath.length - 1].title}
              >
                {activePath[activePath.length - 1].title}
              </div>
            </Fragment>
          )}
        </Fragment>
      )}
    </div>
  );
}
