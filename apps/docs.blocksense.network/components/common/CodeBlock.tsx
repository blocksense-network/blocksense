'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { codeToHtml, ShikiTransformer } from 'shiki';

import { CopyButton } from '@blocksense/docs-ui/CopyButton';
import { shikiDefaultThemes } from '@/config';
import { useTheme } from 'nextra-theme-docs';

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
  themes = shikiDefaultThemes.themes,
  copy = { hasCopyButton: true, disabled: false },
  transformers = [],
  className = '',
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
    })
      .then((htmlString = '') =>
        htmlString.replace(/class="shiki/, `class="shiki ${className}`),
      )
      .then((htmlString = '') =>
        currentTheme === themes.dark
          ? htmlString.replace(/class="shiki/, 'class="shiki dark')
          : htmlString,
      )
      .then(setHtml);
  }, [code, lang, currentTheme, transformers]);

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
