import React from 'react';
import { useEffect, useState } from 'react';
import { ShikiMagicMove } from 'shiki-magic-move/react';
import { type HighlighterCore, createHighlighter } from 'shiki';

import 'shiki-magic-move/dist/style.css';
import { CopyButton } from './CopyButton';

type CodeBlockProps = {
  code: string;
  lang?: string;
  theme?: string;
  lineNumbers?: boolean;
};

/**
 * `CodeBlock` is a React component that renders a block of code with syntax highlighting using Shiki.
 *
 * @param {object} props - The properties passed to the component.
 * @param {string} props.code - The code to be displayed in the block.
 * @param {string} [props.lang='text'] - The language of the code. Default is 'text'.
 * @param {string} [props.theme='material-theme-lighter'] - The theme for the syntax highlighting. Default is 'material-theme-lighter'.
 * @param {boolean} [props.lineNumbers=false] - Whether to display line numbers. Default is false.
 *
 * @returns The rendered code block.
 */
export const CodeBlock = ({
  code,
  lang = 'text',
  theme = 'material-theme-lighter',
  lineNumbers = false,
}: CodeBlockProps) => {
  // State variable for the highlighter instance
  const [highlighter, setHighlighter] = useState<HighlighterCore>();

  // Effect hook to initialize the highlighter
  useEffect(() => {
    async function initializeHighlighter() {
      // Create a new highlighter with the specified themes and languages
      const highlighter = await createHighlighter({
        themes: ['material-theme-lighter', 'github-light', 'github-dark'],
        langs: ['json', 'javascript', 'typescript', 'solidity'],
      });

      // Set the highlighter instance in the state
      setHighlighter(highlighter);
    }

    // Call the initialize function
    initializeHighlighter();
  }, []);

  return (
    <div>
      {highlighter && (
        <div style={{ whiteSpace: 'pre', position: 'relative' }}>
          <CopyButton
            textToCopy={code}
            isCodeSnippet={true}
            tooltipPosition="left"
          />
          {/* Use the ShikiMagicMove component to render the highlighted code */}
          <ShikiMagicMove
            lang={lang}
            theme={theme}
            highlighter={highlighter}
            code={code}
            options={{
              lineNumbers: lineNumbers,
            }}
            className="overflow-x-scroll"
          />
        </div>
      )}
    </div>
  );
};
