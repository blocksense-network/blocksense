import dirTree from 'directory-tree';

import { Config, defaults } from './config';
import { writeArtifactFile } from './utils/common';
import { TreeNode } from './types';
import path from 'path';
import { rootDir } from '@blocksense/base-utils';

export function constructFileTreeStructure(
  { name, children, icon, id, path }: TreeNode,
  idCounter: number = 0,
) {
  path = path!.replace(/.*contracts\/contracts/, '');
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
    path;
    id = 0;
  }
  return { name, children, icon, id, path };
}

export async function contractsFileStructureAsJSON(userConfig?: Config) {
  const contractsPath = path.resolve(
    __dirname,
    `${rootDir}/libs/ts/contracts/contracts`,
  );
  const tree = dirTree(contractsPath);
  const contractsFileStructure = constructFileTreeStructure(tree);
  const config = { ...defaults, ...userConfig };
  await writeArtifactFile(
    contractsFileStructure,
    config,
    'contractsFileStructure',
  );
}
