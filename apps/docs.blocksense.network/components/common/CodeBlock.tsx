'use client';

import React, { useEffect, useState } from 'react';
import { codeToHtml, ShikiTransformer } from 'shiki';

import { CopyButton } from '@/components/common/CopyButton';

type CodeBlockProps = {
  code: string;
  lang?: string;
  theme?: string;
  copy?: {
    hasCopyButton: boolean;
    disabled: boolean;
  };
  transformers?: ShikiTransformer[];
};

export const CodeBlock = ({
  code = '',
  lang = 'text',
  theme = 'material-theme-lighter',
  copy = { hasCopyButton: true, disabled: false },
  transformers = [],
}: CodeBlockProps) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    codeToHtml(code, {
      lang,
      theme,
      transformers,
    }).then((htmlString: string) => setHtml(htmlString));
  }, [code, theme, html]);

  return (
    <div className="relative">
      {copy.hasCopyButton && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="absolute top-2 right-2 nx-z-10"
          disabled={copy.disabled}
        />
      )}
      <div
        className="signature__code grow"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
