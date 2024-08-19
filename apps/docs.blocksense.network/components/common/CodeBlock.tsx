import React from 'react';
import { codeToHtml } from 'shiki';
import { CopyButton } from './CopyButton';
import { useRouter } from 'next/router';
import { transformerOverviewLineLink } from '@/src/contract-overview';

type CodeBlockProps = {
  code: string;
  precompiledHtml?: string;
  lang?: string;
  theme?: string;
  copy?: boolean;
};

// "JIT" in this context refers to the fact that the code block is not precompiled.
const JitCodeBlock = ({
  code = '',
  lang = 'text',
  theme = 'material-theme-lighter',
  copy = true,
}: CodeBlockProps) => {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    codeToHtml(code, {
      lang,
      theme,
    }).then((htmlString: any) => setHtml(htmlString));
  }, [code]);

  return (
    <div className="relative">
      {copy && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="absolute top-2 right-2 m-2 nx-z-10"
        />
      )}
      <div
        className="signature__code flex-grow"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

const PrecompiledCodeBlock = ({
  code = '',
  precompiledHtml = '',
  copy = true,
}: CodeBlockProps) => {
  return (
    <div className="relative">
      {copy && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="absolute top-0 right-0 m-2 nx-z-10"
        />
      )}
      <div
        className="signature__code flex-grow"
        dangerouslySetInnerHTML={{ __html: precompiledHtml }}
      />
    </div>
  );
};

export const CodeBlock = ({
  code = '',
  precompiledHtml = '',
  lang = 'text',
  theme = 'material-theme-lighter',
  copy = true,
}: CodeBlockProps) => {
  return precompiledHtml ? (
    <PrecompiledCodeBlock
      code={code}
      precompiledHtml={precompiledHtml}
      copy={copy}
    />
  ) : (
    <JitCodeBlock code={code} lang={lang} theme={theme} copy={copy} />
  );
};

export const OverviewCodeBlock = ({
  code,
  lang = 'solidity',
  theme = 'material-theme-lighter',
  copy = true,
}: CodeBlockProps) => {
  const router = useRouter();
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    codeToHtml(code, {
      lang,
      theme,
      transformers: [
        transformerOverviewLineLink({
          routeLink: router.route,
          classes: [
            'border border-natural-200 rounded-md p-1 hover:bg-stone-100 cursor-pointer',
          ],
        }),
      ],
    }).then((htmlString: any) => setHtml(htmlString));
  }, [code]);

  return (
    <div style={{ position: 'relative' }}>
      {copy && (
        <CopyButton
          textToCopy={code}
          tooltipPosition="left"
          copyButtonClasses="bg-zinc-50 absolute top-4 right-2 m-2 nx-z-10"
        />
      )}
      <div
        className="signature__code flex-grow"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
