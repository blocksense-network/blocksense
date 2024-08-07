import React from 'react';

import { CodeBlock } from '@/components/common/CodeBlock';

type SignatureProps = {
  signature?: string;
};

export const Signature = ({ signature = '' }: SignatureProps) => {
  return (
    signature && (
      <section className="signature border border-gray-800 mb-2 px-0 py-2 rounded-md bg-slate-100">
        <section className="signature__content justify-between items-start w-full">
          <CodeBlock code={signature} lang="solidity" />
        </section>
      </section>
    )
  );
};
