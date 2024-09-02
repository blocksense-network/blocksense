import cn from 'clsx';
import type { ReactElement, ReactNode } from 'react';
import { createContext, memo, useCallback, useContext, useState } from 'react';

import { EthereumIcon } from '../icons/ethereum';
import { FolderIcon } from '../icons/folder';

const ctx = createContext(0);

function useIndent() {
  return useContext(ctx);
}

interface FolderProps {
  name: string;
  label?: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

interface FileProps {
  name: string;
  label?: ReactElement;
  active?: boolean;
}

function Tree({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className={cn(
        'nextra-filetree nx-select-none nx-text-gray-900 dark:nx-text-gray-300',
        'nx-not-prose', // for nextra-theme-blog
      )}
    >
      <div className="nx-inline-block nx-mt-6 nx-px-4 nx-pb-1 nx-rounded-md nx-border nx-border-neutral-200/70 nx-bg-neutral-900 nx-bg-opacity-[0.02] dark:nx-border-neutral-800">
        {children}
      </div>
    </div>
  );
}

function Indent(): ReactElement {
  const length = useIndent();
  return (
    <>
      {Array.from({ length }, (_, i) => (
        <span className="nx-w-2" key={i} />
      ))}
    </>
  );
}

const Folder = memo<FolderProps>(
  ({ label, name, open, children, defaultOpen = false, onToggle }) => {
    const indent = useIndent();
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const toggle = useCallback(() => {
      onToggle?.(!isOpen);
      setIsOpen(!isOpen);
    }, [isOpen, onToggle]);

    const isFolderOpen = open === undefined ? isOpen : open;

    return (
      <li className="nx-list-none">
        <button
          onClick={toggle}
          title={name}
          className="nx-inline-flex nx-cursor-pointer nx-items-center"
        >
          <Indent />
          <FolderIcon isFolderOpen={isFolderOpen} />
          <span className="nx-m-0 nx-my-0 nx-mx-1 nx-font-bold nx-text-gray-900 dark:nx-text-gray-300">
            {label ?? name}
          </span>
        </button>
        {isFolderOpen && (
          <ul className="file-tree__list file-tree__list--nested">
            <ctx.Provider value={indent + 1}>{children}</ctx.Provider>
          </ul>
        )}
      </li>
    );
  },
);
Folder.displayName = 'Folder';

const File = memo<FileProps>(({ label, name, active }) => (
  <li className={cn('nx-list-none', active && 'contrast-more:nx-underline')}>
    <span className="nx-inline-flex text-sm nx-cursor-default nx-items-center nx-text-gray-900 dark:nx-text-gray-300">
      <Indent />
      <EthereumIcon />
      <span className="nx-m-0 nx-my-0 nx-mx-1">{label ?? name}</span>
    </span>
  </li>
));
File.displayName = 'File';

export const FileTree = Object.assign(Tree, { Folder, File });
