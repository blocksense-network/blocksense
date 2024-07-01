import { ASTNode, ContractDocItem, NatSpec, SolReflection } from '../types';

// The possible tags we support
const tags = [
  '@title',
  '@author',
  '@notice',
  '@dev',
  '@param',
  '@return',
  '@custom',
  '@inheritdoc',
];

/**
 * Parses Natspec comments from an AST node.
 *
 * @param {ASTNode} node - The AST node to parse Natspec comments from.
 * @returns {NatSpec} - The parsed Natspec comments.
 * @throws {ItemError} - Throws an error if an unexpected condition is encountered while parsing the comments.
 * ```
 */
export function parseNatspec(node: ASTNode): NatSpec {
  const natSpec: NatSpec = {};

  const docString =
    'documentation' in node &&
    node.documentation != null &&
    node.documentation.text !== undefined
      ? node.documentation.text
      : '';

  // Regular expression to match tags
  const tagRegex = new RegExp(`(${tags.join('|')})`, 'g');

  // Split the docString into parts
  const tagLines = docString
    .split(tagRegex)
    .map(part => part.trim())
    .filter(part => part.length > 0);

  // Iterate through the parts and apply logic based on the tag
  for (let i = 0; i < tagLines.length; i += 2) {
    const tag = tagLines[i];
    const content = tagLines[i + 1];

    if (!content)
      throw new ItemError(`Found empty content of tag ${tag}`, node);

    switch (tag) {
      case '@title':
      case '@author':
      case '@notice':
      case '@dev':
        type NatSpecField = 'title' | 'author' | 'notice' | 'dev';
        natSpec[tag.replace('@', '') as NatSpecField] = content;
        break;
      case '@param':
        const paramMatches = content.match(/(\w+) ([^]*)/);
        const [, name, description] = paramMatches as [string, string, string];
        natSpec.params ??= [];
        natSpec.params.push({ name, description: description.trim() });
        break;
      case '@return':
        if (!('returnParameters' in node)) {
          throw new ItemError(`Item does not contain return parameters`, node);
        }
        natSpec.returns ??= [];
        const i = natSpec.returns.length;
        const p = node.returnParameters.parameters[i];
        if (p === undefined) {
          throw new ItemError('Got more @return tags than expected', node);
        }
        if (!p.name) {
          natSpec.returns.push({ description: content.trim() });
        } else {
          const paramMatches = content.match(/(\w+)( ([^]*))?/);
          if (!paramMatches || paramMatches[1] !== p.name) {
            throw new ItemError(
              `Expected @return tag to start with name '${p.name}'`,
              node,
            );
          }
          const [, name, description] = paramMatches as [
            string,
            string,
            string?,
          ];
          natSpec.returns.push({
            name,
            description: description?.trim() ?? '',
          });
        }
        break;
      case '@custom':
        const [customTag, ...customDesc] = content.replace(':', '').split(' ');
        if (!customTag) {
          throw new ItemError('Custom tag must be defined', node);
        }
        natSpec.custom ??= {};
        natSpec.custom[customTag] ??= '';
        natSpec.custom[customTag] += customDesc.join(' ');
        break;
      case '@inheritdoc':
        if (
          !(
            node.nodeType === 'FunctionDefinition' ||
            node.nodeType === 'VariableDeclaration'
          )
        ) {
          throw new ItemError(
            `Expected function or variable but saw ${node.nodeType}. ` +
              `Only functions and variables can inherit documentation`,
            node,
          );
        }
        const parentContractName = content.trim();
        natSpec.inheritdoc = {
          name: node.name,
          sourceContract: parentContractName,
        };
        break;
      default:
        console.error('Unknown tag:', tag);
    }
  }

  if (natSpec.dev) natSpec.dev = natSpec.dev.trim();
  if (natSpec.notice) natSpec.notice = natSpec.notice.trim();

  return natSpec;
}

export function appendInheritedNatspec(data: SolReflection) {
  const source = data.map(x => x.fineData).flatMap(su => su.contracts || []);

  data.forEach(({ fineData }) => {
    fineData.contracts?.forEach(contract => {
      contract.functions?.forEach(f => {
        f.natspec = getNatspecWithInheritDoc(f.natspec, source);
      });
      contract.variables?.forEach(v => {
        v.natspec = getNatspecWithInheritDoc(v.natspec, source);
      });
    });
  });
}

export function getNatspecWithInheritDoc(
  natspec: NatSpec,
  source: ContractDocItem[],
): NatSpec {
  if (natspec.inheritdoc) {
    const { name, sourceContract } = natspec.inheritdoc;
    const inheritedDoc = deriveInheritedNatspec(sourceContract, name, source);
    return {
      ...natspec,
      ...inheritedDoc,
    };
  } else {
    return natspec;
  }
}

export function deriveInheritedNatspec(
  contractName: string,
  fieldName: string,
  source: ContractDocItem[],
): NatSpec {
  const contract = source?.find(c => c.name === contractName);
  if (!contract) {
    throw new Error(`Contract ${contractName} not found`);
  }
  const field =
    contract!['functions']?.find(f => f.name === fieldName) ||
    contract!['variables']?.find(v => v.name === fieldName);
  if (!field) {
    throw new Error(`Field ${fieldName} not found in contract ${contractName}`);
  }
  return field.natspec;
}

class ItemError extends Error {
  constructor(msg: string, item: any) {
    if (item) {
      super(msg + ` (${item})`);
    } else {
      super(msg);
    }
  }
}
