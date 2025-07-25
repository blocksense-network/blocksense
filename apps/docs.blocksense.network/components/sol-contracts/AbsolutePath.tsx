import React from 'react';

import Link from 'next/link';

import { Icon } from '@blocksense/docs-ui/Icon';
import { config } from '@/config';
import { ghContractFolder } from '@/src/constants';

type AbsolutePathProps = {
  absolutePath: string;
};

export const AbsolutePath = ({ absolutePath }: AbsolutePathProps) => {
  return (
    <Link
      className="absolute-path__link font-semibold text-sm flex gap-2 items-center"
      href={`${ghContractFolder}${absolutePath}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon
        className="my-1 dark:invert"
        icon={{
          type: 'vector',
          src: 'M12 3C7 3 3 7.13 3 12.23 3 16.31 5.58 19.76 9.15 20.98c.45.08.62-.19.62-.44 0-.22-.01-.94-.01-1.72-2.26.43-2.84-.81-3.02-1.33-.1-.27-.55-1.09-.99-1.31-.34-.18-.82-.64.05-.65.72-.01 1.23.66 1.4.94.82 1.39 2.12 1 2.63.76.08-.6.34-1 .61-1.24-2.2-.23-4.51-1.1-4.51-4.89 0-1.08.39-1.96 1.03-2.65-.1-.23-.45-1.16.1-2.41 0 0 .83-.26 2.73 1.03a9.27 9.27 0 0 1 4.96 0C16.14 6.16 16.97 6.42 16.97 6.42c.55 1.25.2 2.18.1 2.41.64.69 1.03 1.57 1.03 2.65 0 3.8-2.31 4.66-4.51 4.89.35.3.66.9.66 1.81 0 1.31-.01 2.36-.01 2.69 0 .25.17.53.63.44 3.58-1.22 6.15-4.67 6.15-8.75C21 7.13 16.97 3 12 3z',
        }}
        ariaLabel="GitHub Icon"
      />
      {config.github}
    </Link>
  );
};
