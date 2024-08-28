import cn from 'clsx';
import type { Heading } from 'nextra';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { EditIcon } from '../icons/edit';
import { FeedbackIcon } from '../icons/feedback';
import scrollIntoView from 'scroll-into-view-if-needed';
import { useActiveAnchor, useConfig } from '../contexts';
import { renderComponent } from '../utils';
import { Anchor } from './anchor';
import { BackToTop } from './back-to-top';

export type TOCProps = {
  headings: Heading[];
  filePath: string;
};

const linkClassName = cn(
  'nx-text-s nx-font-semibold nx-text-gray-900 hover:nx-opacity-75',
  'contrast-more:nx-text-gray-900 contrast-more:dark:nx-text-gray-50',
);

export function TOC({ headings, filePath }: TOCProps): ReactElement {
  const activeAnchor = useActiveAnchor();
  const config = useConfig();
  const tocRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => headings.filter(heading => heading.depth > 1),
    [headings],
  );

  const hasHeadings = items.length > 0;
  const hasMetaInfo = Boolean(
    config.feedback.content ||
      config.editLink.component ||
      config.toc.extraContent,
  );

  const activeSlug = Object.entries(activeAnchor).find(
    ([, { isActive }]) => isActive,
  )?.[0];

  useEffect(() => {
    if (!activeSlug) return;
    const anchor = tocRef.current?.querySelector(
      `li > a[href="#${activeSlug}"]`,
    );

    if (anchor) {
      scrollIntoView(anchor, {
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
        scrollMode: 'always',
        boundary: tocRef.current,
      });
    }
  }, [activeSlug]);

  return (
    <div
      ref={tocRef}
      className={cn(
        'nextra-scrollbar nx-sticky nx-top-16 nx-overflow-y-auto nx-pr-4 nx-pt-6 nx-text-sm [hyphens:auto]',
        'nx-max-h-[calc(100vh-var(--nextra-navbar-height)-env(safe-area-inset-bottom))] ltr:-nx-mr-4 rtl:-nx-ml-4',
      )}
    >
      {hasHeadings && (
        <>
          <p className="nx-mb-4 nx-font-semibold nx-tracking-tight">
            {renderComponent(config.toc.title)}
          </p>
          <ul>
            {items.map(({ id, value, depth }) => (
              <li
                className="nx-mt-2 nx-scroll-my-6 nx-scroll-py-6 nx-px-2 nx-py-2 nx-border-b nx-border-gray-200 hover:nx-bg-gray-100"
                key={id}
              >
                <a
                  href={`#${id}`}
                  className={cn(
                    {
                      2: 'nx-text-sm',
                      3: 'ltr:nx-pl-4 rtl:nx-pr-2',
                      4: 'ltr:nx-pl-8 rtl:nx-pr-4',
                      5: 'ltr:nx-pl-12 rtl:nx-pr-6',
                      6: 'ltr:nx-pl-16 rtl:nx-pr-8',
                    }[depth as Exclude<typeof depth, 1> as number],
                    'nx-inline-block',
                    activeAnchor[id]?.isActive
                      ? 'nx-text-primary-600 nx-subpixel-antialiased contrast-more:!nx-text-primary-600'
                      : 'nx-text-gray-700 hover:nx-text-gray-900 dark:nx-text-gray-400 dark:hover:nx-text-gray-300',
                    'contrast-more:nx-text-gray-900 contrast-more:nx-underline',
                  )}
                >
                  {config.toc.headingComponent?.({
                    id,
                    children: value,
                  }) ?? value}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasMetaInfo && (
        <div className="nextra-toc__info-container nx-bg-white nx-sticky nx-bottom-0 nx-flex nx-flex-col nx-items-start nx-gap-1 nx-pb-2 dark:nx-border-neutral-800">
          <div
            className={cn(
              hasHeadings && 'nextra-toc__info-section',
              'nx-mt-4 nx-bg-neutral-900 nx-bg-opacity-[0.02] nx-rounded-md nx-border nx-px-6 nx-py-4 nx-border-neutral-200/70 nx-pt-4',
              'contrast-more:nx-border-t contrast-more:nx-border-neutral-400 contrast-more:nx-shadow-none contrast-more:dark:nx-border-neutral-400',
            )}
          >
            <div className="nx-flex nx-items-center nx-gap-2 dark:nx-border-neutral-600">
              <FeedbackIcon />
              {config.feedback.content ? (
                <Anchor
                  className={linkClassName}
                  href={config.feedback.useLink()}
                  newWindow
                >
                  {renderComponent(config.feedback.content)}
                </Anchor>
              ) : null}
            </div>

            <div className="nx-flex nx-items-center nx-gap-2 dark:nx-border-neutral-600">
              <EditIcon />
              {renderComponent(config.editLink.component, {
                filePath,
                className: linkClassName,
                children: renderComponent(config.editLink.text),
              })}
            </div>

            {renderComponent(config.toc.extraContent)}

            {config.toc.backToTop && <BackToTop className={linkClassName} />}
          </div>
        </div>
      )}
    </div>
  );
}
