import React from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { CodeBlock } from '@/components/common/CodeBlock';
import { Signature as SignatureType } from '@blocksense/sol-reflector';

type SignatureProps = {
  signature?: SignatureType;
};

export const Signature = ({
  signature = { codeSnippet: '', signatureCodeSnippetHTML: '' },
}: SignatureProps) => {
  return (
    signature && (
      <section className="signature border border-gray-800 mb-2 px-0 py-2 rounded-md bg-slate-100">
        <section className="signature__content flex justify-between items-start w-full">
          <CodeBlock code={signature.codeSnippet} lang="solidity" />
          <aside className="signature__copy-button mr-6">
            <CopyButton
              textToCopy={signature.codeSnippet}
              tooltipPosition="bottom"
            />
          </aside>
        </section>
      </section>
    )
  );
};
