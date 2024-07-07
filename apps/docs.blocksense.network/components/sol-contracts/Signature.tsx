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
      theme: 'github-light-default',
    })
      .then((htmlString: any) => setHtml(htmlString))
      .finally(() => console.log(html));
  }, []);

  return (
    <div
      className="signature__content bg-white border border-gray-800 mt-2 mb-2 py-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
