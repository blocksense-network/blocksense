import React from 'react';

import { Signature as SignatureType } from '@blocksense/sol-reflector';

import { CodeBlock } from '@/components/common/CodeBlock';

type SignatureProps = {
  signature?: SignatureType;
};

export const Signature = ({
  signature = { codeSnippet: '', signatureCodeSnippetHTML: '' },
}: SignatureProps) => {
  return (
    signature && (
      <section className="signature border border-gray-800 mb-2 px-0 py-2 rounded-md bg-slate-100">
        <section className="signature__content justify-between items-start w-full">
          <CodeBlock
            code={signature.codeSnippet}
            precompiledHtml={signature.signatureCodeSnippetHTML}
          />
        </section>
      </section>
    )
  );
};
