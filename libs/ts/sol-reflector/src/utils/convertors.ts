import type {
  ContractDefinition,
  EnumDefinition,
  ErrorDefinition,
  EventDefinition,
  FunctionDefinition,
  ModifierDefinition,
  PragmaDirective,
  SourceUnit,
  StructDefinition,
  VariableDeclaration,
} from 'solidity-ast';

import type {
  ASTNode,
  DocItemConstructor,
  FunctionModifierDocItem,
  NodeType,
  WithNatspec,
} from '../types';
import {
  ContractDocItem,
  EnumDocItem,
  ErrorDocItem,
  EventDocItem,
  FunctionDocItem,
  isContractDefinition,
  isFunctionDefinition,
  isLiteral,
  isParameterList,
  isSourceUnit,
  isVariableDeclaration,
  ModifierDocItem,
  PragmaDocItem,
  SourceUnitDocItem,
  StructDocItem,
  VariableDocItem,
} from '../types';

import { extractFields } from './common';
import { parseNatspec } from './natspec';
import { getSignature } from './signature';

/**
 * Adds Natspec comments to an AST node.
 *
 * @param {ASTNode} node - The AST node to add Natspec comments to.
 */
export function addNatspec(node: ASTNode): void {
  if ('nodes' in node) {
    node.nodes.forEach(childNode => addNatspec(childNode));
  }
  if ('documentation' in node) {
    node.natspec = parseNatspec(node);
  }
}

/**
 * Converts a SourceUnit node with Natspec comments to a SourceUnitDocItem.
 *
 * @param {WithNatspec<SourceUnit>} node - The SourceUnit node to convert.
 * @returns {SourceUnitDocItem} - The converted SourceUnitDocItem.
 * @throws {Error} - Throws an error if the node is not a SourceUnit.
 */
export function convertSourceUnit(
  node: WithNatspec<SourceUnit>,
): SourceUnitDocItem {
  if (!isSourceUnit(node)) {
    throw new Error('Node is not a source unit');
  }
  const extracted = extractFields(node, SourceUnitDocItem);
  return {
    ...extracted,
    pragmas: derivePragmas(node) || [],
    contracts: node.nodes
      .filter(isContractDefinition)
      .map(convertContract) as ContractDocItem[],
    enums: deriveEnums(node),
    errors: deriveErrors(node),
    functions: deriveFunctions(node),
    structs: deriveStructs(node),
    variables: deriveVariables(node),
  };
}

/**
 * Converts a ContractDefinition AST node with Natspec comments to a ContractDocItem.
 *
 * @param {WithNatspec<ContractDefinition>} node - The ContractDefinition AST node to convert.
 * @returns {ContractDocItem} - The converted ContractDocItem.
 * @throws {Error} - Throws an error if the node is not a ContractDefinition.
 * ```
 */
export function convertContract(
  node: WithNatspec<ContractDefinition>,
): ContractDocItem {
  if (!isContractDefinition(node)) {
    throw new Error('Node is not a contract definition');
  }
  const extracted = extractFields(node, ContractDocItem);
  return {
    ...extracted,
    signature: getSignature(node),
    _baseContracts: node.baseContracts.map(c => c.baseName.name!),
    functions: deriveFunctions(node),
    errors: deriveErrors(node),
    events: deriveEvents(node),
    modifiers: deriveModifiers(node),
    variables: deriveVariables(node),
    enums: deriveEnums(node),
    structs: deriveStructs(node),
  };
}

function deriveErrors(node: ASTNode): ErrorDocItem[] | undefined {
  return deriveNodes<ErrorDocItem, ErrorDefinition>(
    node,
    'ErrorDefinition',
    ErrorDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _parameters: deriveParams(n.parameters),
      };
    },
  );
}

function deriveEvents(node: ASTNode): EventDocItem[] | undefined {
  return deriveNodes<EventDocItem, EventDefinition>(
    node,
    'EventDefinition',
    EventDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _parameters: deriveParams(n.parameters),
      };
    },
  );
}

function deriveFunctions(node: ASTNode): FunctionDocItem[] | undefined {
  return deriveNodes<FunctionDocItem, FunctionDefinition>(
    node,
    'FunctionDefinition',
    FunctionDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _parameters: deriveParams(n.parameters),
        _returnParameters: deriveParams(n.returnParameters),
        _modifiers: deriveFunctionModifiers(n),
      };
    },
  );
}

function deriveModifiers(node: ASTNode): ModifierDocItem[] | undefined {
  return deriveNodes<ModifierDocItem, ModifierDefinition>(
    node,
    'ModifierDefinition',
    ModifierDocItem,
    (n, parsed) => ({
      ...parsed,
      signature: getSignature(n),
      _parameters: deriveParams(n.parameters),
    }),
  );
}

function deriveVariables(node: ASTNode): VariableDocItem[] | undefined {
  return deriveNodes<VariableDocItem, VariableDeclaration>(
    node,
    'VariableDeclaration',
    VariableDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _value: isLiteral(n.value) ? n.value.value : undefined,
      };
    },
  );
}

function deriveEnums(node: ASTNode): EnumDocItem[] | undefined {
  return deriveNodes<EnumDocItem, EnumDefinition>(
    node,
    'EnumDefinition',
    EnumDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _members: n.members.map((m: EnumDefinition) => m.name),
      };
    },
  );
}

function deriveStructs(node: ASTNode): StructDocItem[] | undefined {
  return deriveNodes<StructDocItem, StructDefinition>(
    node,
    'StructDefinition',
    StructDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: getSignature(n),
        _members: (
          n.members.filter(isVariableDeclaration) as VariableDeclaration[]
        ).map(e => {
          return extractFields(e, VariableDocItem);
        }),
      };
    },
  );
}

function deriveParams(node: ASTNode): VariableDocItem[] | undefined {
  return isParameterList(node)
    ? (
        node.parameters.filter(isVariableDeclaration) as VariableDeclaration[]
      ).map(e => {
        return extractFields(e, VariableDocItem);
      })
    : undefined;
}

function deriveFunctionModifiers(
  node: ASTNode,
): FunctionModifierDocItem[] | undefined {
  return isFunctionDefinition(node)
    ? (node.modifiers || []).map(m => {
        const modifier: FunctionModifierDocItem = {
          kind: m.kind!,
          _modifierName: m.modifierName.name,
        };

        return modifier;
      })
    : undefined;
}

function derivePragmas(node: ASTNode): PragmaDocItem[] | undefined {
  return deriveNodes<PragmaDocItem, PragmaDirective>(
    node,
    'PragmaDirective',
    PragmaDocItem,
  );
}

/**
 * Derives documentation items from AST nodes of a specific type.
 *
 * @template T - The type of the documentation item.
 * @template N - The type of the AST node.
 * @param {ASTNode} node - The AST node to derive documentation items from.
 * @param {NodeType} nodeType - The type of the AST node to derive documentation items from.
 * @param {DocItemConstructor<T>} docItemClass - The constructor for the documentation item.
 * @param {(n: any, parsed: any) => T} [convertor] - An optional callback to further process the extracted fields.
 * @returns {T[] | undefined} - An array of documentation items, or undefined if the node is not a ContractDefinition or SourceUnit.
 */
function deriveNodes<T extends Partial<N>, N extends {}>(
  node: ASTNode,
  nodeType: NodeType,
  docItemClass: DocItemConstructor<T>,
  convertor?: (n: any, parsed: any) => T,
): T[] | undefined {
  return isContractDefinition(node) || isSourceUnit(node)
    ? node.nodes
        .filter(n => n.nodeType === nodeType)
        .map(n => {
          let extractedFields = extractFields(n, docItemClass);
          if (convertor) {
            extractedFields = convertor(n, extractedFields);
          }
          return extractedFields;
        })
    : undefined;
}
