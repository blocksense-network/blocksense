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
    <Button className="absolute-path__button" asChild>
      <Link
        className="absolute-path__link font-semibold"
        href={`${ghContractFolder}${absolutePath}`}
      >
        {config.github}
      </Link>
    </Button>
  );
};
