import dirTree from 'directory-tree';

import { Config, defaults } from './config';
import { writeArtifactFile } from './utils/common';
import { TreeNode } from './types';
import path from 'path';
import { rootDir } from '@blocksense/base-utils';

export function constructFileTreeStructure(
  { name, children, icon, id }: TreeNode,
  idCounter: number = 0,
) {
  id = idCounter;
  if (children) {
    icon = 'folder';
    children.map(child => {
      idCounter++;
      delete child.path;
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

export async function contractsFileStructureAsJSON(userConfig?: Config) {
  const contractsPath = path.resolve(
    __dirname,
    `${rootDir}/libs/contracts/contracts`,
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
