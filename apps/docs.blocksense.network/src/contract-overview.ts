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
