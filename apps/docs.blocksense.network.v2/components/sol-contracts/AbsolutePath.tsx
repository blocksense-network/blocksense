import React from 'react';
import Link from 'next/link';

import { config } from '@/config';
import { ghContractFolder } from '@/src/constants';

import { GitHubIcon } from '@/components/common/GitHubIcon';

type AbsolutePathProps = {
  absolutePath: string;
};

export const AbsolutePath = ({ absolutePath }: AbsolutePathProps) => {
  return (
    <Link
      className="absolute-path__link font-semibold text-sm flex gap-2 items-center"
      // href={`${ghContractFolder}${absolutePath}`} //use it after our repo is public on GitHub
      href={`/coming-soon`}
    >
      <GitHubIcon className="my-1" />
      {config.github}
    </Link>
  );
};
