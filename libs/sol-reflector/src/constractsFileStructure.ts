import { Config, defaults } from './config';
import { writeArtifactFile } from './utils/common';

import dirTree from 'directory-tree';

// import { DirectoryTreeCallback } from 'directory-tree';

// Possible Options for ContractsFileStrucutre Type
// export type ContractsFileStructure =
//   | DirectoryTreeCallback<Record<string, any>>
//   | undefined;

export async function prepareObjectStructure(
  artifactsRecord: Record<string, any>,
) {
  for (const key in artifactsRecord) {
    if (key === 'path') {
      const filePath = artifactsRecord['path'];
      const newFilePath = filePath.replace(/.*\/contracts/, '/contracts');
      artifactsRecord['path'] = newFilePath;
      artifactsRecord['icon'] = null;
    } else if (Array.isArray(artifactsRecord[key])) {
      for (let index = 0; index < artifactsRecord[key].length; index++) {
        await prepareObjectStructure(artifactsRecord[key][index]);
      }
    }
  }
  return artifactsRecord;
}

export async function contractsFileStructureAsJSON(
  artifactPath: string,
  userConfig?: Config,
) {
  if (artifactPath) {
    const tree = dirTree(artifactPath);
    const contractsFileStructure = await prepareObjectStructure(tree);
    const config = { ...defaults, ...userConfig };
    await writeArtifactFile(
      contractsFileStructure,
      config,
      'contractsFileStructure',
    );
  }
}
