import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { config } from '@/config';
import { ghContractFolder } from '@/src/constants';

type AbsolutePathProps = {
  absolutePath: string;
};

export const AbsolutePath = ({ absolutePath }: AbsolutePathProps) => {
  return (
    <Button className="absolute-path__button" variant="link" asChild>
      <Link
        className="absolute-path__link font-semibold"
        href={`${ghContractFolder}${absolutePath}`}
      >
        <img
          src="/icons/github.svg"
          alt="GitHub"
          className="w-6 h-6 cursor-pointer ml-[-20px] mr-2"
        />
        {config.github}
      </Link>
    </Button>
  );
};
