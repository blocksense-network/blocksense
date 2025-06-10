import { selectDirectory } from '@blocksense/base-utils/fs';

export async function updateMetaJsonFile(fileDir: string, newContent: any) {
  const { writeJSON, readJSON } = selectDirectory(fileDir);

  let metaFileContent = await readJSON({ name: '_meta' });
  metaFileContent = {
    ...metaFileContent,
    ...newContent,
  };

  return writeJSON({
    base: '_meta.json',
    content: metaFileContent,
  });
}
