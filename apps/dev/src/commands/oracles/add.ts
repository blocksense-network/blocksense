import { join } from 'path';
import { mkdir, writeFile, readFile, rm, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import ejs from 'ejs';
import { parse as parseToml } from 'toml';
import { Effect, Option } from 'effect';
import { Command, Options } from '@effect/cli';
import { Command as PlatformCommand } from '@effect/platform';
import * as NodeContext from '@effect/platform-node/NodeContext';

import { rootDir } from '@blocksense/base-utils/env';
import { renderTui, drawTable } from '@blocksense/base-utils/tty';
import { kebabToHumanReadable } from '@blocksense/base-utils';

const ORACLES_DIR = join(rootDir, 'apps/oracles');
const DEV_TEMPLATES_DIR = join(
  rootDir,
  'apps/dev/src/commands/oracles/templates',
);

export const add = Command.make(
  'add',
  {
    workspaceName: Options.optional(Options.text('workspace-name')),
    description: Options.optional(Options.text('description')),
    noNix: Options.boolean('no-nix').pipe(Options.withDefault(false)),
  },
  ({ description, noNix, workspaceName }) =>
    Effect.gen(function* () {
      const ws = Option.getOrElse(workspaceName, () => '').trim();
      const desc = Option.getOrElse(description, () => '').trim();
      const oname = kebabToHumanReadable(ws);

      if (!isValidWorkspace(ws)) {
        return yield* Effect.fail(
          new Error(
            'Invalid workspace name. Use kebab-case: ^[a-z0-9]+(-[a-z0-9]+)*$',
          ),
        );
      }

      const targetDir = join(ORACLES_DIR, ws);
      const targetExists = yield* pathExists(targetDir);
      if (targetExists) {
        return yield* Effect.fail(
          new Error(`Workspace directory already exists: ${targetDir}`),
        );
      }

      const cargoTomlText = (yield* Effect.tryPromise(() =>
        readFile(join(ORACLES_DIR, 'Cargo.toml'), 'utf8'),
      )) as string;
      if (cargoTomlText.includes(`"${ws}"`)) {
        return yield* Effect.fail(
          new Error(
            `Workspace member '${ws}' already listed in apps/oracles/Cargo.toml`,
          ),
        );
      }

      const wasmFileName = ws.replace(/-/g, '_');
      const componentName = ws;
      const ctx = {
        workspaceName: ws,
        oracleName: oname,
        description: desc,
        wasmFileName,
        componentName,
      } as const;

      yield* ensureTemplates();
      yield* Effect.tryPromise(() =>
        mkdir(join(targetDir, 'src'), { recursive: true }),
      );
      yield* writeOracleWorkspaceFiles(targetDir, ctx);

      yield* addToCargoMembers(ws);
      if (!noNix) {
        yield* addToNixOracleScripts(ws);
        yield* addToNixTestEnv(ws);
      }

      renderTui(
        drawTable(
          [
            ['workspace', ws],
            ['oracle name', oname],
            ['directory', targetDir],
            ['cargo member', 'added'],
            ['nix wiring', noNix ? 'skipped' : 'added'],
          ],
          { headers: ['Item', 'Value'] },
        ),
      );
    }),
);

const isValidWorkspace = (name: string) =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

function pathExists(p: string): Effect.Effect<boolean, never, never> {
  return Effect.gen(function* () {
    const result = yield* Effect.either(
      Effect.tryPromise(() => access(p, fsConstants.F_OK)),
    );
    return result._tag === 'Right';
  });
}

type TemplateContext = {
  workspaceName: string;
  oracleName: string;
  description: string;
  wasmFileName: string;
  componentName: string;
};

function renderTemplate(templateRelPath: string, context: TemplateContext) {
  return Effect.gen(function* () {
    const tpl = (yield* Effect.tryPromise(() =>
      readFile(join(DEV_TEMPLATES_DIR, templateRelPath), 'utf8'),
    )) as string;
    const rendered = yield* Effect.try({
      try: () => ejs.render(tpl, context, { rmWhitespace: false }),
      catch: e => e as Error,
    });
    return rendered as string;
  });
}

function writeOracleWorkspaceFiles(targetDir: string, ctx: TemplateContext) {
  const build = Effect.gen(function* () {
    const [cargoToml, spinToml, libRs] = (yield* Effect.all(
      [
        renderTemplate('Cargo.toml.ejs', ctx),
        renderTemplate('spin.toml.ejs', ctx),
        renderTemplate('src/lib.rs.ejs', ctx),
      ],
      { concurrency: 'unbounded' },
    )) as [string, string, string];

    yield* Effect.all(
      [
        Effect.tryPromise(() =>
          writeFile(join(targetDir, 'Cargo.toml'), cargoToml, 'utf8'),
        ),
        Effect.tryPromise(() =>
          writeFile(join(targetDir, 'spin.toml'), spinToml, 'utf8'),
        ),
        Effect.tryPromise(() =>
          writeFile(join(targetDir, 'src', 'lib.rs'), libRs, 'utf8'),
        ),
      ],
      { concurrency: 'unbounded' },
    );
  });

  return Effect.tapError(build, error =>
    Effect.flatMap(
      Effect.sync(() => {
        console.error(
          `[oracle:add] failed to scaffold workspace '${ctx.workspaceName}': ` +
            `${error instanceof Error ? error.message : String(error)} — removing partial directory ${targetDir}`,
        );
      }),
      () =>
        Effect.tryPromise(() =>
          rm(targetDir, { recursive: true, force: true }),
        ),
    ),
  );
}

function addToCargoMembers(workspaceName: string) {
  return Effect.gen(function* () {
    const filePath = join(ORACLES_DIR, 'Cargo.toml');
    const original = (yield* Effect.tryPromise(() =>
      readFile(filePath, 'utf8'),
    )) as string;
    const parsed = parseToml(original) as any;

    if (!parsed.workspace) parsed.workspace = {};
    if (!Array.isArray(parsed.workspace.members)) parsed.workspace.members = [];
    const members: string[] = parsed.workspace.members;
    if (!members.includes(workspaceName)) members.push(workspaceName);

    const wsStart = original.indexOf('[workspace]');
    if (wsStart === -1) {
      yield* Effect.logWarning(
        `[oracle:add] skipping Cargo.toml update: no [workspace] section found in ${filePath}`,
      );
      return;
    }
    const restFromWs = original.slice(wsStart);
    const wsEndRel = restFromWs.indexOf('\n]');
    const wsEndAbs = wsEndRel === -1 ? original.length : wsStart + wsEndRel + 2;

    const normalizedBlock = [
      '[workspace]',
      'members = [',
      ...members.map(m => `  "${m}",`),
      ']',
    ].join('\n');

    const updated =
      original.slice(0, wsStart) + normalizedBlock + original.slice(wsEndAbs);
    yield* Effect.tryPromise(() => writeFile(filePath, updated, 'utf8'));
  });
}

function formatNixFile(filePath: string): Effect.Effect<void> {
  return PlatformCommand.make('nixfmt', filePath).pipe(
    PlatformCommand.exitCode,
    Effect.flatMap(code =>
      code === 0
        ? Effect.void
        : Effect.logWarning(`nixfmt exited with code ${code} for ${filePath}`),
    ),
    Effect.provide(NodeContext.layer),
    Effect.catchAll(err =>
      Effect.logWarning(
        `nixfmt execution failed for ${filePath}: ${String(err)}`,
      ),
    ),
  );
}

function addToNixOracleScripts(workspaceName: string) {
  return Effect.gen(function* () {
    const filePath = join(rootDir, 'nix', 'pkgs', 'default.nix');
    const original = (yield* Effect.tryPromise(() =>
      readFile(filePath, 'utf8'),
    )) as string;

    if (
      original.includes(`${workspaceName} = mkOracleScript "${workspaceName}";`)
    ) {
      yield* Effect.logInfo(
        'Oracle script already present in nix/pkgs/default.nix',
      );
      return;
    }

    const m = original.match(/(oracle-scripts\s*=\s*\{)/m);
    if (!m || m.index === undefined) {
      yield* Effect.logWarning(
        `[oracle:add] nix/pkgs/default.nix: could not locate 'oracle-scripts' attrset; skipping insertion for '${workspaceName}'`,
      );
      return;
    }
    const startIdx = m.index + m[0].length;

    // Find the closing brace of the oracle-scripts attrset, accounting for nested braces
    let depth = 1;
    let i = startIdx;
    let endIdx = -1;
    while (i < original.length) {
      const ch = original[i++];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) {
      yield* Effect.logWarning(
        `[oracle:add] nix/pkgs/default.nix: malformed 'oracle-scripts' attrset (no closing brace); skipping insertion for '${workspaceName}'`,
      );
      return;
    }

    const insertion = `${workspaceName} = mkOracleScript "${workspaceName}";`;
    const updated =
      original.slice(0, endIdx - 1) + insertion + original.slice(endIdx - 1);

    yield* Effect.tryPromise(() => writeFile(filePath, updated, 'utf8'));
    yield* formatNixFile(filePath);
  });
}

function addToNixTestEnv(workspaceName: string) {
  return Effect.gen(function* () {
    const filePath = join(
      rootDir,
      'nix/test-environments/example-setup-01.nix',
    );
    const original = (yield* Effect.tryPromise(() =>
      readFile(filePath, 'utf8'),
    )) as string;
    const already = new RegExp(`\\n\\s*${workspaceName}\\s*=\\s*\\{`, 'm').test(
      original,
    );
    if (already) {
      yield* Effect.logWarning(
        `[oracle:add] test environment already contains oracle '${workspaceName}', skipping`,
      );
      return;
    }

    const m = original.match(/(oracles\s*=\s*\{)/m);
    if (!m || m.index === undefined) {
      yield* Effect.logWarning(
        `[oracle:add] nix/test-environments/example-setup-01.nix: could not locate 'oracles' attrset; skipping wiring for '${workspaceName}'`,
      );
      return;
    }
    const startIdx = m.index + m[0].length;

    let depth = 1;
    let i = startIdx;
    let endIdx = -1;
    while (i < original.length) {
      const ch = original[i++];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) {
      yield* Effect.logWarning(
        `[oracle:add] nix/test-environments/example-setup-01.nix: malformed 'oracles' attrset (no closing brace); skipping wiring for '${workspaceName}'`,
      );
      return;
    }

    const block = `\n${workspaceName} = {\n exec-interval = 10;\n  allowed-outbound-hosts = [ ];\n};`;
    const updated =
      original.slice(0, endIdx - 1) + block + original.slice(endIdx - 1);
    yield* Effect.tryPromise(() => writeFile(filePath, updated, 'utf8'));
    yield* formatNixFile(filePath);
  });
}

function ensureTemplates(): Effect.Effect<void, Error, never> {
  return Effect.gen(function* () {
    const needed = ['Cargo.toml.ejs', 'spin.toml.ejs', 'src/lib.rs.ejs'];

    const templateChecks = yield* Effect.all(
      needed.map(f =>
        Effect.gen(function* () {
          const p = join(DEV_TEMPLATES_DIR, f);
          const exists = yield* pathExists(p);
          return { file: f, path: p, exists };
        }),
      ),
      { concurrency: 'unbounded' },
    );

    const missing = templateChecks.filter(check => !check.exists);
    if (missing.length > 0) {
      const missingPaths = missing.map(m => m.path).join(', ');
      return yield* Effect.fail(
        new Error(`Missing templates: ${missingPaths}`),
      );
    }
  });
}
