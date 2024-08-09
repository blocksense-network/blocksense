import type { ShikiTransformer } from 'shiki';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { filterConstants, filterVariables } from '@/utils';
import { table } from 'console';

/**
 * Adds a specified number of tabs before the content.
 *
 * @param tabCount - The number of tabs to add.
 * @param content - The content to which tabs will be added.
 * @returns The content with added tabs.
 */
function addIndentation(tabCount: number, content: string): string {
  return '\t'.repeat(tabCount) + content;
}

/**
 * Generates a formatted string containing the specified field of each object in the data array,
 * with the component name as a comment.
 *
 * @param componentName - The name of the component to include in the comment.
 * @param data - An array of objects containing the data.
 * @param field - The field to extract from each object in the data array.
 * @returns A formatted string with the component name and the extracted fields, or a newline if the data is empty or undefined.
 */
function formatComponentData(
  componentName: string,
  data: Array<Record<string, any>> | undefined,
): string {
  if (!data || data.length === 0) {
    return '';
  }

  // console.log(data);
  const formattedData = data
    .map(item =>
      addIndentation(1, `${item['signature']['overviewCodeSnippet']}`),
    )
    .join('\n');
  return `  //${componentName}\n${formattedData}\n`;
}

/**
 * Generates the overview code content for a given contract.
 *
 * @param contract - The contract for which to generate the overview code content.
 * @returns The generated overview code content as a string.
 */
export function getOverviewCodeContent(contract: ContractDocItem): string {
  let content = ''
    .concat(formatComponentData('Enums', contract.enums))
    .concat(formatComponentData('Structures', contract.structs))
    .concat(
      formatComponentData('Constants', filterConstants(contract.variables)),
    )
    .concat(
      formatComponentData('Variables', filterVariables(contract.variables)),
    )
    .concat(formatComponentData('Errors', contract.errors))
    .concat(formatComponentData('Events', contract.events))
    .concat(formatComponentData('Modifiers', contract.modifiers))
    .concat(formatComponentData('Functions', contract.functions));

  let contractData = `contract ${contract.name} {\n${content}}`;

  return contractData;
}

/**
 * Options for the `transformerOverviewLineLink` function.
 *
 * @property {string} routeLink - The base URL to which the target keyword will be appended as a URL fragment.
 * @property {string[]} [classes] - Optional. Additional CSS classes to apply to the line of code.
 */
export interface TransformerLineLinkOption {
  routeLink: string;
  classes?: string[];
}

/**
 * Creates a Shiki transformer that adds an `onclick` event to a line of code,
 *  redirecting to a specific URL when clicked.
 *
 * @param {TransformerLineLinkOption} params - The options for the transformer.
 *  Should include `routeLink` and optionally `classes`.
 * @returns {ShikiTransformer} - The created Shiki transformer.
 *
 * @note The `routeLink` option is used as the base URL, and the target keyword
 *  extracted from the code line is appended as a URL fragment.
 */
export function transformerOverviewLineLink(
  params: TransformerLineLinkOption,
): ShikiTransformer {
  return {
    name: 'transformer-line-link',
    line(node) {
      if (params.classes) this.addClassToHast(node, params.classes);

      const target = getUrlTarget(node);
      node.properties = {
        ...node.properties,
        onclick: `window.location.href='${params.routeLink}#${target}'`,
      };
    },
  };
}

/**
 * Extracts the target keyword from a code snippet to be used as a URL fragment.
 * @note The result of this function is used to be added to a URL that navigates
 * to a specific part of a page in the documentation website.
 */
function getUrlTarget(node: any): string {
  const codeSnippetTokens = getCodeSnippetTokens(node);
  const index = codeSnippetTokens.findIndex((token: string) =>
    smartContractOverviewKeyWords.includes(token),
  );
  const target =
    index !== -1
      ? codeSnippetTokens[index + 1]
      : codeSnippetTokens.includes('constructor')
        ? 'constructor'
        : codeSnippetTokens.includes('fallback')
          ? 'fallback'
          : codeSnippetTokens[1];
  return target;
}

/**
 * Extracts the tokens from a shiki code snippet represented as a nested structure of nodes.
 */
function getCodeSnippetTokens(node: any): string[] {
  return node.children
    .flat()
    .map((child: any) => {
      if ('children' in child)
        return child.children.flat().map((c: any) => {
          if ('value' in c) return c.value.trim();
        });
    })
    .flat();
}
/**
 * Keywords that are used to identify the type of a smart contract element.
 */
const smartContractOverviewKeyWords: string[] = [
  'enum',
  'struct',
  'error',
  'event',
  'modifier',
  'function',
  'constant',
  'immutable',
  'contract',
];
