import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import { generateCodeSnippetHTML } from '@blocksense/base-utils/syntax-highlighting';

import { ASTNode, Signature, SolReflection, SourceUnitDocItem } from '../types';
import { formatVariable, iterateContractElements } from './common';

export function getSignature(node: ASTNode): Signature | undefined {
  switch (node.nodeType) {
    case 'ContractDefinition':
      return {
        codeSnippet: `contract ${node.name} { ... };`,
        signatureCodeSnippetHTML: '',
      };

    case 'FunctionDefinition': {
      const { kind, name } = node;
      const params = node.parameters.parameters;
      const returns = node.returnParameters.parameters;
      const head =
        kind === 'function' || kind === 'freeFunction'
          ? `function ${name}`
          : kind;
      let res = [
        `${head}(${params.map(formatVariable).join(', ')})`,
        node.visibility,
      ];
      if (node.stateMutability !== 'nonpayable') {
        res.push(node.stateMutability);
      }
      if (node.virtual) {
        res.push('virtual');
      }
      if (returns.length > 0) {
        res.push(
          `returns (${returns.map(formatVariable).join(', ').replace('contract', '')})`,
        );
      }

      const codeSnippet = res.join(' ').concat(';');

      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
      };
    }

    case 'EventDefinition': {
      const params = node.parameters.parameters;
      return {
        codeSnippet: `event ${node.name}(${params.map(formatVariable).join(', ')});`,
        signatureCodeSnippetHTML: '',
      };
    }

    case 'ErrorDefinition': {
      const params = node.parameters.parameters;
      return {
        codeSnippet: `error ${node.name}(${params.map(formatVariable).join(', ')});`,
        signatureCodeSnippetHTML: '',
      };
    }

    case 'ModifierDefinition': {
      const params = node.parameters.parameters;
      return {
        codeSnippet: `modifier ${node.name}(${params.map(formatVariable).join(', ')});`,
        signatureCodeSnippetHTML: '',
      };
    }

    case 'VariableDeclaration':
      return {
        codeSnippet: `${formatVariable(node)};`,
        signatureCodeSnippetHTML: '',
      };

    case 'EnumDefinition':
      return {
        codeSnippet: `enum ${node.name} { ... };`,
        signatureCodeSnippetHTML: '',
      };

    case 'StructDefinition':
      return {
        codeSnippet: `struct ${node.name} { ... };`,
        signatureCodeSnippetHTML: '',
      };

    default:
      return undefined;
  }
}

/**
 * Formats and highlights the signatures of all elements in a SolReflection object.
 *
 * @param {SolReflection} docItem The SolReflection object containing the
 *  elements to format and highlight.
 *
 * @returns {Promise<void>} This function returns a Promise that resolves
 *   when all signatures have been formatted and highlighted.
 */
export async function formatAndHighlightSignatures(docItem: SolReflection) {
  for (const { element } of iterateContractElements(docItem)) {
    if (!element.signature) {
      continue;
    }
    await formatAndHighlightSignature(element.signature);
  }
}

/**
 * Formats and highlights a signature.
 *
 * @param {Signature} signature Signature to format and highlight.
 *
 * @returns {Promise<void>} This function returns a Promise that resolves when
 *  the signature has been formatted and highlighted.
 */
async function formatAndHighlightSignature(signature: Signature) {
  if (signature?.codeSnippet) {
    const formattedCodeSnippet = await formatCodeSnippet(signature.codeSnippet);
    const highlightedSignatureHTML = await generateCodeSnippetHTML(
      formattedCodeSnippet,
      'solidity',
    );

    signature.codeSnippet = formattedCodeSnippet;
    signature.signatureCodeSnippetHTML = highlightedSignatureHTML;
  }
}

/**
 * Formats Solidity code snippet using Prettier. If the code snippet is
 * longer than 80 characters, it is formatted; otherwise, it will stay the same.
 *
 * @param {string} code A code snippet to format.
 *
 * @returns {Promise<string>} This function returns a Promise that resolves
 *  the formatted code snippet.
 */
async function formatCodeSnippet(code: string): Promise<string> {
  return code.length > 80
    ? await prettier.format(code, {
        parser: 'solidity-parse',
        plugins: [solidityPlugin],
      })
    : code;
}
