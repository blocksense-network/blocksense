'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { codeToHtml, ShikiTransformer } from 'shiki';
import { useTheme } from 'nextra-theme-docs';

import { CopyButton } from '@/components/common/CopyButton';

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
};

export const CodeBlock = ({
  code = '',
  lang = 'text',
  themes = {
    light: 'material-theme-lighter',
    dark: 'vitesse-dark',
  },
  copy = { hasCopyButton: true, disabled: false },
  transformers = [],
}: CodeBlockProps) => {
  const [html, setHtml] = useState('');
  const { theme, systemTheme } = useTheme();

  const currentTheme = useMemo(() => {
    if (theme === 'system') {
      return systemTheme === 'light' ? themes.light : themes.dark;
    }
    return theme === 'light' ? themes.light : themes.dark;
  }, [theme, systemTheme, themes]);

  useEffect(() => {
    codeToHtml(code, {
      lang,
      theme: currentTheme,
      transformers,
    }).then(setHtml);
  }, [code, lang, currentTheme, transformers]);

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
