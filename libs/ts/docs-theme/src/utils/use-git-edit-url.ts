import * as path from 'path';

import gitUrlParse from 'git-url-parse';
import { useConfig } from '../contexts';

import SOL_REFLECTION_JSON from '@blocksense/contracts/docs/fine';

export function useGitEditUrl(filePath = ''): string {
  const config = useConfig();
  const repo = gitUrlParse(config.docsRepositoryBase || '');

  if (!repo) throw new Error('Invalid `docsRepositoryBase` URL!');

  if (filePath.includes('reference-documentation')) {
    const contractFileName = path.basename(filePath).replace('.mdx', '.sol');
    let gitAbsolutePath = 'edit/main/libs/ts/contracts/';
    SOL_REFLECTION_JSON.some((sourceUnit: any) => {
      if (sourceUnit.absolutePath.includes(contractFileName)) {
        gitAbsolutePath += sourceUnit.absolutePath;
        return true;
      }
    });
    return `${repo.href}/${gitAbsolutePath}`;
  } else {
    const gitEditUrlPart = 'edit/main/apps/docs.blocksense.network';
    return `${repo.href}/${gitEditUrlPart}/${filePath}`;
  }
}
