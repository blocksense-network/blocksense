import { ASTNode } from '../types';
import { formatVariable } from './common';

export function getSignature(node: ASTNode): string | undefined {
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
      return res.join(' ').concat(';');
    }

    case 'EventDefinition': {
      const params = node.parameters.parameters;
      return `event ${node.name}(${params.map(formatVariable).join(', ')});`;
    }

    case 'ErrorDefinition': {
      const params = node.parameters.parameters;
      return `error ${node.name}(${params.map(formatVariable).join(', ')});`;
    }

    case 'ModifierDefinition': {
      const params = node.parameters.parameters;
      return `modifier ${node.name}(${params.map(formatVariable).join(', ')});`;
    }

    case 'VariableDeclaration':
      return `${formatVariable(node)};`;

    case 'EnumDefinition':
      return `enum ${node.name} { ... };`;

    case 'StructDefinition':
      return `struct ${node.name} { ... };`;

    default:
      return undefined;
  }
}
