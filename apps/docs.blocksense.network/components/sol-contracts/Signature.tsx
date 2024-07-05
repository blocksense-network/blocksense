import React from 'react';
import { codeToHtml } from 'shiki';

type SignatureProps = {
  signature?: string;
};

export const Signature = ({ signature }: SignatureProps) => {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    codeToHtml(signature!, {
      lang: 'solidity',
      theme: 'catppuccin-mocha',
    })
      .then((htmlString: any) => setHtml(htmlString))
      .finally(() => console.log(html));
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};
