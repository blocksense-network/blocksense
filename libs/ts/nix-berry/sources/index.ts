import { Plugin, Report } from '@yarnpkg/core';
import * as lockfile from '@yarnpkg/parsers';
import { Option } from 'clipanion';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as process from 'process';

let isDebug = false;

const yarnCachePath = 'nix/pkgs/yarn/offline-cache/';
let files = {
  missing_hash: {
    path: yarnCachePath + 'missing-hash.json',
    lastModified: '1970-01-01T00:00:00Z',
  },
  nix_hash: {
    path: yarnCachePath + 'nix-hash.txt',
    lastModified: '1970-01-01T00:00:00Z',
  },
  yarn_lock: {
    path: 'yarn.lock',
    lastModified: '1970-01-01T00:00:00Z',
  },
  processed_yarn_lock: {
    path: '/tmp/yarn.lock',
    lastModified: '1970-01-01T00:00:00Z',
  },
};
let missingHashDataModified = {};

function promisify(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.on('error', reject);
    childProcess.on('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      }
      resolve(undefined);
    });
    childProcess.on('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      }
      resolve(undefined);
    });
  });
}

function runCommandInit(options, Report) {
  let report = options.report;
  return async function (command, file, msg) {
    if (files[file].lastModified >= files.yarn_lock.lastModified) {
      report.reportInfo(0, msg.skip);
      return;
    }

    const progress = Report.progressViaTitle();
    report.reportInfo(0, msg.progress);
    const reportedProgress = await report.reportProgress(progress);

    let commandOut = spawn(command.name, command.args, {
      shell: true,
      cwd: options.cwd,
    });

    let commandPromise = promisify(commandOut);
    const jsonFile = fs.createWriteStream(files[file].path);

    commandOut.stdout.on('data', data => {
      jsonFile.write(data.toString().trim());
    });
    commandOut.stderr.on('data', data => {
      if (isDebug) {
        report.reportInfo(0, data.toString().trim());
      }
      progress.setTitle(data.toString().trim().split('\n')[0]);
    });
    commandOut.on('exit', code => {
      if (code == 0) {
        report.reportInfo(0, msg.finish);
      }
      jsonFile.end();
      reportedProgress.stop();
    });

    await commandPromise;
  };
}
// ...existing code...
function preprocessLock(options, Report) {
  const yarnLockString = fs.readFileSync(files.yarn_lock.path, 'utf8');
  const yarnLockData = lockfile.parseSyml(yarnLockString);
  const missingHashData = JSON.parse(
    fs.readFileSync(files.missing_hash.path, 'utf8'),
  );

  // Identify entries to remove from yarnLockData and populate missingHashDataModified
  for (const key of Object.keys(missingHashData)) {
    if (Object.hasOwn(yarnLockData, key)) {
      delete yarnLockData[key];
      missingHashDataModified[key] = missingHashData[key];
    }
  }

  const keysOfModifiedEntries = Object.keys(missingHashDataModified);

  // Iterate through the remaining entries in yarnLockData
  for (const entryKey of Object.keys(yarnLockData)) {
    // console.log("-",entryKey);
    const removeModifiedDependencies = depKey => {
      if (Object.hasOwn(yarnLockData[entryKey], depKey)) {
        // console.log("--", depKey);
        for (const modifiedKey of keysOfModifiedEntries) {
          let dep = modifiedKey.split('@npm')[0];
          if (Object.hasOwn(yarnLockData[entryKey][depKey], dep)) {
            // console.log("---", dep);
            delete yarnLockData[entryKey][depKey][dep];
          }
        }
      }
    };

    removeModifiedDependencies('dependencies');
    removeModifiedDependencies('peerDependencies');
    removeModifiedDependencies('dependenciesMeta');
    removeModifiedDependencies('peerDependenciesMeta');
  }

  fs.writeFileSync(
    files.processed_yarn_lock.path,
    yarnLockString.split('\n').slice(0, 3).join('\n') +
      '\n' +
      lockfile.stringifySyml(yarnLockData),
  );
}
// ...existing code...

const plugin: Plugin = {
  name: 'nix-berry',
  hooks: {
    async afterAllInstalled(project, options) {
      let report = options.report;

      Object.keys(files).forEach(key => {
        files[key].lastModified = fs.existsSync(files[key].path)
          ? fs.statSync(files[key].path).mtime
          : files[key].lastModified;
      });
      const runCommand = runCommandInit(options, Report);

      await report.startTimerPromise('Generating nix files', async () => {
        preprocessLock(options, Report);

        await runCommand(
          {
            name: 'yarn-berry-fetcher',
            args: [
              'missing-hashes',
              files.processed_yarn_lock.path,
              files.missing_hash.path,
            ],
          },
          'missing_hash',
          {
            skip: 'Missing hashes are up to date',
            progress:
              'Generating missing hashes for yarn.lock (may take a while)...',
            finish: 'Missing hashes generated successfully',
          },
        );

        const missingHashData = JSON.parse(
          fs.readFileSync(files.missing_hash.path, 'utf8'),
        );
        if (Object.keys(missingHashDataModified).length > 0) {
          fs.writeFileSync(
            files.missing_hash.path,
            JSON.stringify(
              Object.assign(missingHashData, missingHashDataModified),
              null,
              2,
            ),
          );
          report.reportInfo(0, 'Updated missing hashes file with new entries');
        }
        await runCommand(
          {
            name: 'yarn-berry-fetcher',
            args: ['prefetch', files.yarn_lock.path, files.missing_hash.path],
          },
          'nix_hash',
          {
            skip: 'Yarn nix hash is up to date',
            progress: 'Generating yarn nix hash (may take a while)...',
            finish: 'Yarn nix hash generated successfully',
          },
        );
      });
    },
  },
};

export default plugin;
