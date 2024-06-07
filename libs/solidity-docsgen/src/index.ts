import { Config, defaults } from './config';
import { Build } from './types';

import {
  ASTNode,
  isSourceUnit,
  isContractDefinition,
  SourceUnitDocItem,
} from './types';

import './hardhat/type-extensions';
import { filterRelevantFiles, writeDocFiles } from './utils/common';
import { parseNatspec } from './utils/natspec';
import { parseSourceUnit } from './utils/parsers';

if ('extendConfig' in global && 'task' in global) {
  // Assume Hardhat.
  require('./hardhat');
}

export function visitNode(
  node: ASTNode,
  doc: SourceUnitDocItem,
): { node: ASTNode; doc: SourceUnitDocItem } {
  if (isSourceUnit(node)) {
    // Visit all child nodes recursively
    node.nodes.forEach(childNode => visitNode(childNode, doc));
    // Parse all relevant information for the fine version of the documentation
    doc = parseSourceUnit(node);
  } else if (isContractDefinition(node)) {
    // Parse natspec for the contract and visit all child nodes of contract
    node.natspec = parseNatspec(node);
    node.nodes.forEach(childNode => visitNode(childNode, doc));
  } else if (('documentation' in node && node?.documentation) ?? '' != '') {
    // Parse natspec for nodes with documentation
    node.natspec = parseNatspec(node);
  }
  return { node, doc };
}

export async function main(
  builds: Build[],
  userConfig?: Config,
): Promise<void> {
  const config = { ...defaults, ...userConfig };
  const content: { rawData: ASTNode; fineData: SourceUnitDocItem }[] = [];
  for (let { output } of builds) {
    const files = filterRelevantFiles(output, config);

    files.map(file => {
      const { node, doc } = visitNode(file.ast, {} as SourceUnitDocItem);
      content.push({ rawData: node, fineData: doc });
    });

    await writeDocFiles(content, userConfig);
  }
}

// We ask Node.js not to cache this file.
delete require.cache[__filename];

export * from './types';
export * from './utils/common';
export * from './utils/natspec';
export * from './utils/parsers';
