import * as fs from 'fs';
import * as path from 'path';

export function createFsIOForDir(baseDir: string) {
  type Location = Omit<path.FormatInputPathObject, 'dir'>;

  return {
    write: (args: Location & { content: string }) =>
      fs.writeFile(
        path.format({ dir: baseDir, ...args }),
        args.content,
        (err: any) => {
          if (err) {
            console.log(err);
          }
        },
      ),

    writeJSON: (args: Location & { content: Record<string, unknown> }) =>
      fs.writeFile(
        path.format({ dir: baseDir, ...args }),
        JSON.stringify(args.content, null, 2),
        (err: any) => {
          if (err) {
            console.log(err);
          }
        },
      ),

    read: (args: Location) =>
      fs.readFile(path.format({ dir: baseDir, ...args }), (err: any) => {
        if (err) throw err;
      }),

    readJSON: (args: Location) =>
      fs.readFile(path.format({ dir: baseDir, ...args }), (err: any) => {
        if (err) throw err;
      }),
  };
}
