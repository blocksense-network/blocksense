import React from 'react';
import { codeToHtml } from 'shiki';
import { CopyButton } from './CopyButton';

type CodeBlockProps = {
  code: string;
  precompiledHtml?: string;
  lang?: string;
  theme?: string;
  copy?: boolean;
};

export const CodeBlock = ({
  code,
  precompiledHtml = '',
  lang = 'text',
  theme = 'material-theme-lighter',
  copy = true,
}: CodeBlockProps) => {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    precompiledHtml
      ? setHtml(precompiledHtml)
      : codeToHtml(code, {
          lang,
          theme,
        }).then((htmlString: any) => setHtml(htmlString));
  }, [code]);

  return (
    <div style={{ position: 'relative' }}>
      {copy && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="absolute top-0 right-0 m-2 nx-z-10"
        />
      )}
      <div
        className="signature__code flex-grow"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
