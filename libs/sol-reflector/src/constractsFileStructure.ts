import { Config, defaults } from './config';
import { TreeNode, writeArtifactFile } from './utils/common';

import dirTree from 'directory-tree';

export async function addIconsToFolderTree({ name, children, icon }: TreeNode) {
  if (children) {
    icon = 'folder';
    children.map(child => {
      delete child.path;
      child['icon'] = 'solidity';
      if (child.children) {
        child['icon'] = 'folder';
        addIconsToFolderTree(child);
      }
    });
  }
  return { name, children, icon };
}

export async function contractsFileStructureAsJSON(
  artifactPath: string,
  userConfig?: Config,
) {
  if (artifactPath) {
    const tree = dirTree(artifactPath);
    const contractsFileStructure = await addIconsToFolderTree(tree);
    const config = { ...defaults, ...userConfig };
    await writeArtifactFile(
      contractsFileStructure,
      config,
      'contractsFileStructure',
    );
  }
}
