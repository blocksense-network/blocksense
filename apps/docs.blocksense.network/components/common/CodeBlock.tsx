import React from 'react';
import { codeToHtml } from 'shiki';

type CodeBlockProps = {
  code: string;
  lang?: string;
  theme?: string;
};

export const CodeBlock = ({
  code = '',
  lang = 'text',
  theme = 'material-theme-lighter',
}: CodeBlockProps) => {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    codeToHtml(code, {
      lang,
      theme,
    }).then((htmlString: any) => setHtml(htmlString));
  }, [code]);

  return (
    <div
      className="signature__code flex-grow mr-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
