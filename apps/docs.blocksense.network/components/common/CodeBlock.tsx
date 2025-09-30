'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ShikiTransformer } from 'shiki';
import { codeToHtml } from 'shiki';

import { CopyButton } from '@blocksense/docs-ui/CopyButton';
import { useTheme } from '@blocksense/nextra-theme-docs';
import { shikiDefaultThemes } from '@/config';

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
  className = '',
  code = '',
  copy = { hasCopyButton: true, disabled: false },
  lang = 'text',
  themes = shikiDefaultThemes.themes,
  transformers = [],
}: CodeBlockProps) => {
  const [html, setHtml] = useState('');
  const { systemTheme, theme } = useTheme();

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
