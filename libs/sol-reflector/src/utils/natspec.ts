import { ASTNode, NatSpec } from '../types';

// The possible tags we support
const tags = [
  '@title',
  '@author',
  '@notice',
  '@dev',
  '@param',
  '@return',
  '@custom',
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

    switch (tag) {
      case '@title':
      case '@author':
      case '@notice':
      case '@dev':
        if (!content)
          throw new ItemError(`Found empty content of tag ${tag}`, node);
        natSpec[tag.replace('@', '')] = content;
        break;
      case '@param':
        if (!content)
          throw new ItemError(`Found empty content of tag ${tag}`, node);
        const paramMatches = content.match(/(\w+) ([^]*)/);
        const [, name, description] = paramMatches as [string, string, string];
        natSpec.params ??= [];
        natSpec.params.push({ name, description: description.trim() });
        break;
      case '@return':
        if (!content)
          throw new ItemError(`Found empty content of tag ${tag}`, node);
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
        if (!content)
          throw new ItemError(`Found empty content of tag ${tag}`, node);
        const [customTag, ...customDesc] = content.replace(':', '').split(' ');
        if (!customTag) {
          throw new ItemError('Custom tag must be defined', node);
        }
        natSpec.custom ??= {};
        natSpec.custom[customTag] ??= '';
        natSpec.custom[customTag] += customDesc.join(' ');
        break;
      default:
        console.log('Unknown tag:', tag);
    }
  }

  if (natSpec.dev) natSpec.dev = natSpec.dev.trim();
  if (natSpec.notice) natSpec.notice = natSpec.notice.trim();

  return natSpec;
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
