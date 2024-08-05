import React from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { CodeBlock } from '@/components/common/CodeBlock';

type SignatureProps = {
  signature?: string;
};

export const Signature = ({ signature = '' }: SignatureProps) => {
  return (
    signature && (
      <section className="signature__container border border-gray-800 mb-2 px-0 py-2 rounded-md bg-slate-100">
        <div className="signature__content flex justify-between items-start w-full">
          <CodeBlock code={signature} lang="solidity" />
          <aside className="signature__copy-button flex-shrink-0 mr-6">
            <CopyButton textToCopy={signature} />
          </aside>
        </div>
      </section>
    )
  );
};
