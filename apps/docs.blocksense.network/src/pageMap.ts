import * as path from 'path';
import { SourceUnitDocItem } from '@blocksense/sol-reflector';
import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';
const solReflection = SOL_REFLECTION_JSON as SourceUnitDocItem[];

const overviewInfo = [
  {
    name: 'Overview',
    route: '/docs/contracts/reference-documentation/Overview',
    frontMatter: {
      title: 'Overview',
      filePath: 'app/docs/contracts/reference-documentation/Overview/page.mdx',
    },
  },
];

export function updatePageMapWithContractsRefDoc(pageMap: any) {
  pageMap
    .find((node: any) => 'name' in node && node.name === 'docs')
    .children.find((node: any) => 'name' in node && node.name === 'contracts')
    .children.find(
      (node: any) => 'name' in node && node.name === 'reference-documentation',
    ).children = [...overviewInfo, ...getContractsRefDocPagesInfo()];
}

export function getContractsRefDocPagesInfo() {
  return solReflection.map((sourceUnit: SourceUnitDocItem) => {
    const contractName = path.parse(sourceUnit.absolutePath).name;
    return {
      name: contractName,
      route: `/docs/contracts/reference-documentation/contract/${contractName}`,
      frontMatter: {
        title: contractName,
        filePath: `app/docs/contracts/reference-documentation/${contractName}/page.mdx`,
      },
    };
  });
}
