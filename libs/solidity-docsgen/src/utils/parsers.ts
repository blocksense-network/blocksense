import {
  EnumDefinition,
  ErrorDefinition,
  EventDefinition,
  FunctionDefinition,
  ModifierDefinition,
  PragmaDirective,
  StructDefinition,
  VariableDeclaration,
  SourceUnit,
} from 'solidity-ast';
import {
  ASTNode,
  ContractDocItem,
  EnumDocItem,
  ErrorDocItem,
  EventDocItem,
  FunctionDocItem,
  FunctionModifierDocItem,
  ModifierDocItem,
  PragmaDocItem,
  SourceUnitDocItem,
  StructDocItem,
  VariableDocItem,
  isContractDefinition,
  isFunctionDefinition,
  isLiteral,
  isParameterList,
  isSourceUnit,
  isVariableDeclaration,
  WithNatspec,
} from '../types';
import { extractFields, formatVariable } from './common';

type NodeType =
  | 'ErrorDefinition'
  | 'EventDefinition'
  | 'FunctionDefinition'
  | 'ModifierDefinition'
  | 'VariableDeclaration'
  | 'EnumDefinition'
  | 'StructDefinition'
  | 'PragmaDirective';

type DocItemConstructor<T> = new (...args: any[]) => T;

export function parseSourceUnit(
  node: WithNatspec<SourceUnit>,
): SourceUnitDocItem {
  if (!isSourceUnit(node)) {
    throw new Error('Node is not a source unit');
  }
  const extracted = extractFields(node, SourceUnitDocItem);
  return {
    ...extracted,
    pragmas: parsePragmas(node) || [],
    contracts: node.nodes
      .filter(isContractDefinition)
      .map(parseContract) as ContractDocItem[],
    enums: parseEnums(node),
    errors: parseErrors(node),
    functions: parseFunctions(node),
    structs: parseStructs(node),
    variables: parseVariables(node),
  };
}

export function parseContract(node: ASTNode): ContractDocItem {
  if (!isContractDefinition(node)) {
    throw new Error('Node is not a contract definition');
  }
  const extracted = extractFields(node, ContractDocItem);
  return {
    ...extracted,
    _baseContracts: node.baseContracts.map(c => c.baseName.name!),
    functions: parseFunctions(node),
    errors: parseErrors(node),
    events: parseEvents(node),
    modifiers: parseModifiers(node),
    variables: parseVariables(node),
    enums: parseEnums(node),
    structs: parseStructs(node),
  };
}
export function parseErrors(node: ASTNode): ErrorDocItem[] | undefined {
  return parseNodes<ErrorDocItem, ErrorDefinition>(
    node,
    'ErrorDefinition',
    ErrorDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: parseSignature(n),
        _parameters: parseParams(n.parameters),
      };
    },
  );
}

export function parseEvents(node: ASTNode): EventDocItem[] | undefined {
  return parseNodes<EventDocItem, EventDefinition>(
    node,
    'EventDefinition',
    EventDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: parseSignature(n),
        _params: parseParams(n.parameters),
      };
    },
  );
}

export function parseFunctions(node: ASTNode): FunctionDocItem[] | undefined {
  return parseNodes<FunctionDocItem, FunctionDefinition>(
    node,
    'FunctionDefinition',
    FunctionDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: parseSignature(n),
        _parameters: parseParams(n.parameters),
        _returnParameters: parseParams(n.returnParameters),
        _modifiers: parseFunctionModifiers(n),
      };
    },
  );
}

export function parseModifiers(node: ASTNode): ModifierDocItem[] | undefined {
  return parseNodes<ModifierDocItem, ModifierDefinition>(
    node,
    'ModifierDefinition',
    ModifierDocItem,
    (n, parsed) => ({
      ...parsed,
      signature: parseSignature(n),
      _parameters: parseParams(n.parameters),
    }),
  );
}

export function parseVariables(node: ASTNode): VariableDocItem[] | undefined {
  return parseNodes<VariableDocItem, VariableDeclaration>(
    node,
    'VariableDeclaration',
    VariableDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        signature: parseSignature(n),
        _value: isLiteral(n.value) ? n.value.value : undefined,
      };
    },
  );
}

export function parseEnums(node: ASTNode): EnumDocItem[] | undefined {
  return parseNodes<EnumDocItem, EnumDefinition>(
    node,
    'EnumDefinition',
    EnumDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        _members: n.members.map(m => m.name),
      };
    },
  );
}

export function parseStructs(node: ASTNode): StructDocItem[] | undefined {
  return parseNodes<StructDocItem, StructDefinition>(
    node,
    'StructDefinition',
    StructDocItem,
    (n, parsed) => {
      return {
        ...parsed,
        _members: (
          n.members.filter(isVariableDeclaration) as VariableDeclaration[]
        ).map(e => {
          return extractFields(e, VariableDocItem);
        }),
      };
    },
  );
}

export function parseParams(node: ASTNode): VariableDocItem[] | undefined {
  return isParameterList(node)
    ? (
        node.parameters.filter(isVariableDeclaration) as VariableDeclaration[]
      ).map(e => {
        return extractFields(e, VariableDocItem);
      })
    : undefined;
}

export function parseFunctionModifiers(
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

export function parseSignature(node: ASTNode): string | undefined {
  switch (node.nodeType) {
    case 'ContractDefinition':
      return undefined;

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
        res.push(`returns (${returns.map(formatVariable).join(', ')})`);
      }
      return res.join(' ');
    }

    case 'EventDefinition': {
      const params = node.parameters.parameters;
      return `event ${node.name}(${params.map(formatVariable).join(', ')})`;
    }

    case 'ErrorDefinition': {
      const params = node.parameters.parameters;
      return `error ${node.name}(${params.map(formatVariable).join(', ')})`;
    }

    case 'ModifierDefinition': {
      const params = node.parameters.parameters;
      return `modifier ${node.name}(${params.map(formatVariable).join(', ')})`;
    }

    case 'VariableDeclaration':
      return formatVariable(node);
  }
}

export function parsePragmas(node: ASTNode): PragmaDocItem[] | undefined {
  return parseNodes<PragmaDocItem, PragmaDirective>(
    node,
    'PragmaDirective',
    PragmaDocItem,
  );
}

function parseNodes<T extends Partial<N>, N extends {}>(
  node: ASTNode,
  nodeType: NodeType,
  docItemClass: DocItemConstructor<T>,
  callback?: (n: any, parsed: any) => T,
): T[] | undefined {
  return isContractDefinition(node) || isSourceUnit(node)
    ? node.nodes
        .filter(n => n.nodeType === nodeType)
        .map(n => {
          let extractedFields = extractFields(n, docItemClass);
          if (callback) {
            extractedFields = callback(n, extractedFields);
          }
          return extractedFields;
        })
    : undefined;
}
