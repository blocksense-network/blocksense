import React from 'react';

import type { Signature as SignatureType } from '@blocksense/sol-reflector';
import { CodeBlock } from '@/components/common/CodeBlock';

type SignatureProps = {
  signature?: SignatureType;
};

export const Signature = ({
  signature = { codeSnippet: '' },
}: SignatureProps) => {
  return (
    signature && (
      <section className="signature rounded-md">
        <section className="signature__content justify-between items-start w-full p-0">
          <CodeBlock code={signature.codeSnippet} lang="solidity" />
        </section>
      </section>
    )
  );
};
