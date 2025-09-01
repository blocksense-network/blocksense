import { createInterface, Interface } from 'node:readline/promises';

import { assert } from './assert';

let _readline: Interface | null = null;

export function getTextWidth(str: string) {
  // 1. Remove ANSI escape sequences.
  const cleanedStr = str.replace(/\u001b\[[0-9;?]*m/g, '');
  if (!cleanedStr) return 0; // Handle empty or only-ANSI string

  const segmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  });

  let width = 0;
  for (const { segment: grapheme } of segmenter.segment(cleanedStr)) {
    const firstCodePoint = grapheme.codePointAt(0);
    // 2. Disallow newline/tab.
    if (grapheme === '\n' || grapheme === '\t' || firstCodePoint == null) {
      throw new Error(
        `Unsupported char: '${grapheme === '\n' ? '\\n' : '\\t'}'`,
      );
    }

    // Check if the grapheme is composed of exactly this single code point.
    const isSingleCodePointGrapheme =
      String.fromCodePoint(firstCodePoint) === grapheme;

    // 3. Handle single-width characters:
    //    - Printable ASCII (U+0020 space to U+007E ~)
    //    - Box Drawing characters (U+2500 to U+257F)
    if (
      isSingleCodePointGrapheme &&
      ((firstCodePoint >= 0x20 && firstCodePoint <= 0x7e) ||
        (firstCodePoint >= 0x2000 && firstCodePoint <= 0x206f) || // General Punctuation
        (firstCodePoint >= 0x2500 && firstCodePoint <= 0x257f))
    ) {
      width += 1;
      // 4. Approximate emoji detection (width 2):
      //    - Grapheme's first char is Extended_Pictographic OR
      //    - Grapheme consists of more than one Unicode scalar value (complex emoji).
    } else if (
      /\p{Extended_Pictographic}/u.test(String.fromCodePoint(firstCodePoint)) ||
      !isSingleCodePointGrapheme
    ) {
      width += 2;
    } else {
      // 5. Throw for anything else.
      throw new Error(
        `Unsupported grapheme: '${grapheme}' (U+${firstCodePoint.toString(16).toUpperCase()})`,
      );
    }
  }
  return width;
}

export function readline(): Interface {
  if (!_readline) {
    _readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return _readline;
}

export const { isTTY } = process.stdout;

/**
 * ANSI escape sequences mapping.
 * Keys are the style names you'll use in the template literal (e.g., {bold ...}).
 * Each entry has an 'on' and 'off' code.
 * 'off' codes are crucial for proper nesting and preventing style bleed.
 */
const ttyStyles = {
  // Styles
  reset: { on: '\u001b[0m', off: '' }, // Reset all, 'off' is empty as it's a full reset
  bold: { on: '\u001b[1m', off: '\u001b[22m' },
  dim: { on: '\u001b[2m', off: '\u001b[22m' }, // Dim and Bold share an off code
  italic: { on: '\u001b[3m', off: '\u001b[23m' },
  underline: { on: '\u001b[4m', off: '\u001b[24m' },
  blink: { on: '\u001b[5m', off: '\u001b[25m' },
  inverse: { on: '\u001b[7m', off: '\u001b[27m' },
  hidden: { on: '\u001b[8m', off: '\u001b[28m' }, // aka conceal
  strikethrough: { on: '\u001b[9m', off: '\u001b[29m' },

  // Foreground colors
  black: { on: '\u001b[30m', off: '\u001b[39m' },
  red: { on: '\u001b[31m', off: '\u001b[39m' },
  green: { on: '\u001b[32m', off: '\u001b[39m' },
  yellow: { on: '\u001b[33m', off: '\u001b[39m' },
  blue: { on: '\u001b[34m', off: '\u001b[39m' },
  magenta: { on: '\u001b[35m', off: '\u001b[39m' },
  cyan: { on: '\u001b[36m', off: '\u001b[39m' },
  white: { on: '\u001b[37m', off: '\u001b[39m' },
  gray: { on: '\u001b[90m', off: '\u001b[39m' }, // Bright black
  grey: { on: '\u001b[90m', off: '\u001b[39m' }, // Alias for gray

  // Bright foreground colors
  brightRed: { on: '\u001b[91m', off: '\u001b[39m' },
  brightGreen: { on: '\u001b[92m', off: '\u001b[39m' },
  brightYellow: { on: '\u001b[93m', off: '\u001b[39m' },
  brightBlue: { on: '\u001b[94m', off: '\u001b[39m' },
  brightMagenta: { on: '\u001b[95m', off: '\u001b[39m' },
  brightCyan: { on: '\u001b[96m', off: '\u001b[39m' },
  brightWhite: { on: '\u001b[97m', off: '\u001b[39m' },

  // Background colors
  bgBlack: { on: '\u001b[40m', off: '\u001b[49m' },
  bgRed: { on: '\u001b[41m', off: '\u001b[49m' },
  bgGreen: { on: '\u001b[42m', off: '\u001b[49m' },
  bgYellow: { on: '\u001b[43m', off: '\u001b[49m' },
  bgBlue: { on: '\u001b[44m', off: '\u001b[49m' },
  bgMagenta: { on: '\u001b[45m', off: '\u001b[49m' },
  bgCyan: { on: '\u001b[46m', off: '\u001b[49m' },
  bgWhite: { on: '\u001b[47m', off: '\u001b[49m' },
  bgGray: { on: '\u001b[100m', off: '\u001b[49m' }, // Bright black background
  bgGrey: { on: '\u001b[100m', off: '\u001b[49m' }, // Alias

  // Bright background colors
  bgBrightRed: { on: '\u001b[101m', off: '\u001b[49m' },
  bgBrightGreen: { on: '\u001b[102m', off: '\u001b[49m' },
  bgBrightYellow: { on: '\u001b[103m', off: '\u001b[49m' },
  bgBrightBlue: { on: '\u001b[104m', off: '\u001b[49m' },
  bgBrightMagenta: { on: '\u001b[105m', off: '\u001b[49m' },
  bgBrightCyan: { on: '\u001b[106m', off: '\u001b[49m' },
  bgBrightWhite: { on: '\u001b[107m', off: '\u001b[49m' },
};

/**
 * Template literal tag function to apply ANSI styles.
 * Usage: color`{bold This is {red bold red}} and this is normal.`
 * @param {string[]} strings - Array of static string parts.
 * @param  {...any} values - Array of evaluated expressions.
 * @returns {string} - The string with ANSI escape codes applied.
 */
export function color(strings: TemplateStringsArray, ...values: unknown[]) {
  // 1. Reconstruct the raw string with interpolated values
  let rawString = strings[0];
  for (let i = 0; i < values.length; i++) {
    rawString += values[i] + strings[i + 1];
  }

  // 2. Recursive parser function
  function parseAndStyle(text: string) {
    let result = '';
    let currentIndex = 0;

    while (currentIndex < text.length) {
      // Regex to find the start of a style tag: {styleName<space>
      // We look for a word followed by a space after '{'
      const openTagMatch = text.substring(currentIndex).match(/{(\w+)\s/);

      if (!openTagMatch || typeof openTagMatch.index === 'undefined') {
        // No more tags, append the rest of the text
        result += text.substring(currentIndex);
        break;
      }

      const tagStartIndex = currentIndex + openTagMatch.index;
      const styleName = openTagMatch[1];
      // contentStartIndex is after "{styleName "
      const contentStartIndex = tagStartIndex + styleName.length + 2; // 1 for '{', 1 for space

      // Append text before this tag
      result += text.substring(currentIndex, tagStartIndex);

      // Find the matching closing brace '}' for this tag
      // This needs to handle nested braces correctly.
      let braceBalance = 1;
      let contentEndIndex = -1;
      for (let i = contentStartIndex; i < text.length; i++) {
        if (text[i] === '{') {
          // Check if it's a new style tag or just a literal brace
          // A simple heuristic: if it's followed by a word and a space, assume new tag
          if (text.substring(i).match(/{(\w+)\s/)) {
            braceBalance++;
          }
        } else if (text[i] === '}') {
          braceBalance--;
          if (braceBalance === 0) {
            contentEndIndex = i;
            break;
          }
        }
      }

      if (contentEndIndex === -1) {
        // Malformed: no closing brace. Treat the rest as literal.
        // This includes the opening part of the malformed tag.
        console.warn(
          `[tty-color] Malformed style tag: No closing brace for '{${styleName}' starting at index ${tagStartIndex} in chunk "${text.substring(currentIndex, currentIndex + 30)}..."`,
        );
        result += text.substring(tagStartIndex);
        currentIndex = text.length; // End processing
      } else {
        const content = text.substring(contentStartIndex, contentEndIndex);
        const ttyStyles_: Record<string, { on: string; off: string }> =
          ttyStyles;
        const style = ttyStyles_[styleName];

        if (style) {
          result += style.on;
          result += parseAndStyle(content); // Recursive call for the content
          result += style.off;
        } else {
          // Unknown style, output the tag literally but parse its content
          console.warn(`[tty-color] Unknown style: ${styleName}`);
          result += `{${styleName} `;
          result += parseAndStyle(content); // Still parse content for nested known styles
          result += `}`;
        }
        currentIndex = contentEndIndex + 1;
      }
    }
    return result;
  }

  return parseAndStyle(rawString);
}

export function alignText(
  text: string,
  width: number,
  alignDir: 'left' | 'center' | 'right',
  padding = ' ',
) {
  const textWidth = getTextWidth(text);
  if (textWidth >= width) return text;
  const paddingLength = width - textWidth;
  switch (alignDir) {
    case 'left':
      return text + padding.repeat(paddingLength);
    case 'right':
      return padding.repeat(paddingLength) + text;
    case 'center': {
      const leftPadding = Math.floor(paddingLength / 2);
      const rightPadding = paddingLength - leftPadding;
      return padding.repeat(leftPadding) + text + padding.repeat(rightPadding);
    }
    default:
      throw new Error(`Invalid alignment direction: ${alignDir}`);
  }
}

export const alignLeft = (text: string, width: number, padding = ' ') =>
  alignText(text, width, 'left', padding);
export const alignRight = (text: string, width: number, padding = ' ') =>
  alignText(text, width, 'right', padding);
export const alignCenter = (text: string, width: number, padding = ' ') =>
  alignText(text, width, 'center', padding);

export type RenderArgs = { maxWidth: number };

export type Element = string | ((args: RenderArgs) => string[]);

export const renderTui = (...elements: Element[]): void =>
  console.log(
    renderToString({ maxWidth: process.stdout.columns }, ...elements),
  );

export const renderToString = (
  args: RenderArgs,
  ...elements: Element[]
): string => renderAllElements(args, ...elements).join('\n');

export const renderAllElements = (
  args: RenderArgs,
  ...elements: Element[]
): string[] => elements.flatMap(e => renderSingleElement(args, e));

export function renderSingleElement(args: RenderArgs, el: Element): string[] {
  const res = typeof el === 'function' ? el(args) : [el];

  for (let i = 0; i < res.length; i++) {
    const line = res[i];
    if (typeof line !== 'string') {
      throw new Error(`Expected a string, but got '${line}'`);
    }
    const wrappedContent = wrapLines(line, args.maxWidth);
    res.splice(i, 1, ...wrappedContent);
    i += wrappedContent.length - 1;
  }

  // trim lines which overflow after wrapping
  for (let i = 0; i < res.length; i++) {
    const line = res[i];
    if (getTextWidth(line) > args.maxWidth) {
      res[i] = line.slice(0, args.maxWidth);
    }
  }

  return res;
}

export function renderSingleLine(args: RenderArgs, el: Element): string {
  const lines = renderSingleElement(args, el);
  if (lines.length != 1) {
    throw new Error(`Expected a single line, but got ${lines.length} lines`);
  }
  return lines[0];
}

export function wrapLines(text: string, width: number) {
  if (getTextWidth(text) <= width) {
    return [text];
  }
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const wordWidth = getTextWidth(word);
    if (currentLine.length + wordWidth > width) {
      lines.push(currentLine);
      currentLine = '';
    }
    if (currentLine.length > 0) {
      currentLine += ' ';
    }
    currentLine += word;
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

// UI utils

export const line = (len: number) => '─'.repeat(len);

export const vlist = (lines: string[]) => lines.map(l => color`• {bold ${l}}`);

export const drawTitle = (txt: Element) => (args: RenderArgs) => [
  color`╼ {bold ${renderSingleLine(args, txt)}} ╾`,
];

export const drawBox =
  (title: Element, ...content: Element[]) =>
  (args: RenderArgs) => {
    args = { maxWidth: args.maxWidth - 4 };
    title = renderSingleLine(args, drawTitle(title));
    const renderedContent = renderAllElements(args, ...content);
    const contentWidth = [title, ...renderedContent].reduce(
      (max, line) => Math.max(max, getTextWidth(line)),
      0,
    );
    assert(
      contentWidth <= args.maxWidth,
      `Content is too wide: ${contentWidth} > ${args.maxWidth}`,
    );
    const boxWidth = Math.min(contentWidth, args.maxWidth);
    const topBorder = `╭${alignLeft(title, boxWidth + 2, '─')}╮`;
    const botBorder = `╰${line(boxWidth + 2)}╯`;
    const result = [];
    result.push(topBorder);
    for (const line of renderedContent) {
      result.push(`│ ${alignLeft(line, boxWidth, ' ')} │`);
    }
    result.push(botBorder);
    return result;
  };

export type TableCell = Element;
export type TableRow = TableCell[];
export type Align = 'left' | 'center' | 'right';

interface TableOptions {
  headers?: TableCell[];
  align?: Align[];
}

export const drawTable =
  (rows: TableRow[], options: TableOptions = {}) =>
  (args: RenderArgs): string[] => {
    const { headers, align = [] } = options;
    const colCount = Math.max(...rows.map(r => r.length), headers?.length ?? 0);

    const normalizedRows = rows.map(row =>
      Array.from({ length: colCount }, (_, i) => row[i] ?? ''),
    );
    const normalizedHeaders = headers
      ? Array.from({ length: colCount }, (_, i) => headers[i] ?? '')
      : null;

    const renderedCells: string[][][] = normalizedRows.map(row =>
      row.map(cell => renderAllElements(args, cell)),
    );
    const renderedHeaders: string[][] | null = normalizedHeaders
      ? normalizedHeaders.map(cell => renderAllElements(args, cell))
      : null;

    const colWidths: number[] = [];
    for (let col = 0; col < colCount; col++) {
      let maxWidth = 0;
      for (const row of renderedCells) {
        for (const line of row[col]) {
          maxWidth = Math.max(maxWidth, getTextWidth(line));
        }
      }
      if (renderedHeaders) {
        for (const line of renderedHeaders[col]) {
          maxWidth = Math.max(maxWidth, getTextWidth(line));
        }
      }
      colWidths[col] = maxWidth;
    }

    const wrapAndAlign = (lines: string[], width: number, a: Align) =>
      wrapLines(lines.join('\n'), width).map(l => alignText(l, width, a));

    const renderRow = (row: string[][], isHeader = false): string[] => {
      const wrapped = row.map((lines, i) =>
        wrapAndAlign(lines, colWidths[i], align[i] ?? 'left'),
      );
      const height = Math.max(...wrapped.map(c => c.length));
      for (const cell of wrapped) {
        while (cell.length < height)
          cell.push(' '.repeat(colWidths[wrapped.indexOf(cell)]));
      }

      return Array.from(
        { length: height },
        (_, i) => '│ ' + wrapped.map(cell => cell[i]).join(' │ ') + ' │',
      );
    };

    const horizontal = (
      left: string,
      sep: string,
      right: string,
      filler = '─',
    ) => left + colWidths.map(w => filler.repeat(w + 2)).join(sep) + right;

    const lines: string[] = [];

    lines.push(horizontal('┌', '┬', '┐'));

    if (renderedHeaders) {
      lines.push(
        ...renderRow(renderedHeaders, true).map(line => color`{bold ${line}}`),
      );
      lines.push(horizontal('├', '┼', '┤'));
    }

    renderedCells.forEach((row, i) => {
      lines.push(...renderRow(row));
      if (i < renderedCells.length - 1) {
        lines.push(horizontal('├', '┼', '┤'));
      }
    });

    lines.push(horizontal('└', '┴', '┘'));

    return lines;
  };
