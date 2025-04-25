import path from 'path';

import { Config, defaults } from './config';
import { writeArtifactFile, generateFileTree } from './utils/common';
import { TreeNode } from './types';
import { rootDir, selectDirectory } from '@blocksense/base-utils';

function constructFileTreeStructure(
  {
    name,
    children,
    icon,
    id,
  }: TreeNode<{ path?: string; icon?: 'folder' | 'solidity'; id?: number }>,
  idCounter: number = 0,
) {
  id = idCounter;
  if (children) {
    icon = 'folder';
    children.map(child => {
      idCounter++;
      child.path = child.path!.replace(/.*contracts\/contracts\//, '');
      child['icon'] = 'solidity';
      child['id'] = idCounter;
      if (child.children) {
        idCounter++;
        child['icon'] = 'folder';
        child['id'] = idCounter;
        constructFileTreeStructure(child, idCounter);
      }
    });
  } else {
    children = [];
    icon = 'folder';
    id = 0;
  }
  return { name, children, icon, id };
}

export async function enableFileTree(userConfig?: Config) {
  const config = { ...defaults, ...userConfig };

  const contractsPath = path.resolve(
    __dirname,
    `${rootDir}/libs/ts/contracts/contracts`,
  );
  const outDir = path.resolve(config.root, config.outputDir);

  const tree = await generateFileTree(contractsPath);
  // Filter out test and experiments folders. Leave only production contracts.
  tree.children = tree.children!.filter(
    (el: any) => el.name !== 'test' && el.name !== 'experiments',
  );

  const contractsFileStructure = constructFileTreeStructure(tree);
  const { writeJSON } = selectDirectory(outDir);

  await writeJSON({
    name: 'contractsFileStructure',
    content: contractsFileStructure,
  });
}
