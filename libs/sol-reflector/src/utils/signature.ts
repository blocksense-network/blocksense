import * as prettier from 'prettier/standalone';
import solidityPlugin from 'prettier-plugin-solidity';

import { generateCodeSnippetHTML } from '@blocksense/base-utils/syntax-highlighting';

import { ASTNode, Signature, SolReflection } from '../types';
import { formatVariable, iterateContractElements } from './common';

export function getSignature(node: ASTNode): Signature | undefined {
  let codeSnippet = '';
  switch (node.nodeType) {
    case 'ContractDefinition':
      return {
        codeSnippet: `contract ${node.name}`,
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
      let overviewCodeSnippet = '';

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

      overviewCodeSnippet = res
        .filter(el => !el.includes('returns'))
        .join(' ')
        .concat(';');
      codeSnippet = res.join(' ').concat(';');

      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet,
      };
    }

    case 'EventDefinition': {
      const params = node.parameters.parameters;
      codeSnippet = `event ${node.name}(${params.map(formatVariable).join(', ')});`;
      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: codeSnippet,
        type: node.nodeType,
      };
    }

    case 'ErrorDefinition': {
      const params = node.parameters.parameters;
      codeSnippet = `error ${node.name}(${params.map(formatVariable).join(', ')});`;
      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: codeSnippet,
        type: node.nodeType,
      };
    }

    case 'ModifierDefinition': {
      const params = node.parameters.parameters;
      codeSnippet = `modifier ${node.name}(${params.map(formatVariable).join(', ')});`;
      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: codeSnippet,
        type: node.nodeType,
      };
    }

    case 'VariableDeclaration':
      const variableSignature = [node.typeName?.typeDescriptions.typeString!]
        .concat(node.visibility)
        .concat(
          node.constant || node.mutability == 'immutable'
            ? node.mutability
            : [],
        )
        .concat(node.name || [])
        .join(' ');

      return {
        codeSnippet: `${variableSignature};`,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: variableSignature,
        type: node.nodeType,
      };

    case 'EnumDefinition':
      codeSnippet = `enum ${node.name} { ... };`;
      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: codeSnippet,
        type: node.nodeType,
      };

    case 'StructDefinition':
      codeSnippet = `struct ${node.name} { ... };`;
      return {
        codeSnippet,
        signatureCodeSnippetHTML: '',
        overviewCodeSnippet: codeSnippet,
        type: node.nodeType,
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
    const formattedCodeSnippet =
      signature.type != 'VariableDeclaration'
        ? await formatCodeSnippet(signature.codeSnippet)
        : signature.codeSnippet;
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
