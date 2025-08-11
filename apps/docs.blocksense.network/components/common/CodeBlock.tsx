'use client';

import React, { useEffect, useState } from 'react';
import { codeToHtml, ShikiTransformer } from 'shiki';

import { CopyButton } from '@blocksense/docs-ui/CopyButton';

type CodeBlockProps = {
  code: string;
  lang?: string;
  themes?: {
    light: string;
    dark: string;
  };
  copy?: {
    hasCopyButton: boolean;
    disabled: boolean;
  };
  transformers?: ShikiTransformer[];
  className?: string;
};

export const CodeBlock = ({
  code = '',
  lang = 'text',
  copy = { hasCopyButton: true, disabled: false },
  transformers = [],
  className = '',
}: CodeBlockProps) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    codeToHtml(code, {
      lang,
      transformers,
      theme: 'github-dark',
    })
      .then((htmlString = '') =>
        htmlString.replace(/class="shiki/, `class="shiki ${className}`),
      )
      .then(setHtml);
  }, [code, lang, transformers]);

  return (
    <div className="relative">
      {copy.hasCopyButton && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="absolute top-2 right-2 m-2"
          disabled={copy.disabled}
        />
      )}
      <div
        className="signature__code"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
