import type { ShikiTransformer } from 'shiki';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { filterConstants, filterVariables } from '@/src/utils';

/**
 * Adds a specified number of tabs before the content.
 */
function indent(tabCount: number, content: string): string {
  return '\t'.repeat(tabCount) + content;
}

/**
 * Generates a formatted string containing the specified field of each object in the data array,
 * with the component name as a comment.
 */
function formatComponentData(
  componentName: string,
  data: Array<Record<string, any>> | undefined,
): string {
  if (!data || data.length === 0) {
    return '';
  }

  const formattedData = data
    .map(item => indent(1, `${item['signature']['overviewCodeSnippet']}`))
    .join('\n');
  return `    // ${componentName}\n${formattedData}\n`;
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
