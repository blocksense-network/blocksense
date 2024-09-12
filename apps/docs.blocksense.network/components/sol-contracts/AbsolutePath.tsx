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
      className="absolute-path__link font-semibold mx-2 my-3 text-sm flex items-center"
      href={`${ghContractFolder}${absolutePath}`}
    >
      <GitHubIcon className="w-6 h-6 cursor-pointer ml-[-20px] mr-2" />
      {config.github}
    </Link>
  );
};
