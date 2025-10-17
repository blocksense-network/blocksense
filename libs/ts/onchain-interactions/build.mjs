#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';

const scripts = [
  { src: 'balance-script', bin: 'balance-script' },
  { src: 'check-pending-tx', bin: 'check-pending-tx' },
  { src: 'cost-calculations', bin: 'cost-calculations' },
  { src: 'unstuck-transaction', bin: 'unstuck-transaction' }
];

const outDir = 'dist/scripts';

// Determine build mode
const useEsbuild = process.env.USE_ESBUILD === 'true' || process.env.NIX_BUILD === 'true';
const format = process.env.BUILD_FORMAT || (useEsbuild ? 'cjs' : 'esm');

console.log(`[onchain-interactions] Building with ${useEsbuild ? 'esbuild' : 'tsc'} (format: ${format})...`);

// Create output directory
mkdirSync(outDir, { recursive: true });

if (useEsbuild) {
  // Esbuild approach - better for Nix and production
  for (const script of scripts) {
    console.log(`[onchain-interactions] Building ${script.src}...`);

    // Use yarn to run esbuild if not in Nix environment
    const esbuildCmd = process.env.NIX_BUILD === 'true' ? 'esbuild' : 'yarn esbuild';
    const cmd = [
      esbuildCmd,
      `src/scripts/${script.src}.ts`,
      '--bundle',
      '--platform=node',
      '--target=node18',
      `--format=${format}`,
      `--outfile=${outDir}/${script.bin}.js`,
      '--external:prom-client',
      '--external:web3',
      '--external:viem',
      '--external:yargs',
      '--external:yargs/helpers',
      '--external:axios',
      '--external:dotenv',
      '--external:express',
      '--external:@blocksense/contracts',
      '--external:@blocksense/base-utils',
      '--external:@blocksense/base-utils/*',
      '--external:chalk',
      '--external:zod',
      '--minify-whitespace',
      '--keep-names'
    ].join(' ');

    try {
      execSync(cmd, { stdio: 'inherit' });

      // Add shebang and fix imports
      let content = readFileSync(`${outDir}/${script.bin}.js`, 'utf8');

      // Add shebang if not present
      if (!content.startsWith('#!')) {
        content = `#!/usr/bin/env node\n${content}`;
      }

      // Fix web3 import interop for CommonJS
      if (format === 'cjs') {
        content = content.replace(/import_web3\.default/g, 'import_web3.Web3');
        content = content.replace(/new import_web3\(/g, 'new import_web3.Web3(');
      }

      writeFileSync(`${outDir}/${script.bin}.js`, content);
      chmodSync(`${outDir}/${script.bin}.js`, 0o755);

    } catch (error) {
      console.error(`Error building ${script.src}:`, error.message);
      process.exit(1);
    }
  }
} else {
  // TypeScript compiler approach - for development
  console.log('[onchain-interactions] Compiling with TypeScript...');

  try {
    // Use yarn to run tsc if not in Nix environment
    const tscCommand = process.env.NIX_BUILD === 'true' ? 'tsc -p tsconfig.json' : 'yarn tsc -p tsconfig.json';
    execSync(tscCommand, { stdio: 'inherit' });

    // Add shebangs to compiled files
    for (const script of scripts) {
      const filePath = `${outDir}/${script.bin}.js`;
      let content = readFileSync(filePath, 'utf8');

      if (!content.startsWith('#!')) {
        content = `#!/usr/bin/env node\n${content}`;
        writeFileSync(filePath, content);
      }

      chmodSync(filePath, 0o755);
    }
  } catch (error) {
    console.error('TypeScript compilation failed:', error.message);
    process.exit(1);
  }
}

// Update package.json for CommonJS builds
if (format === 'cjs') {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

  // Save original type if present
  if (packageJson.type && !packageJson._originalType) {
    packageJson._originalType = packageJson.type;
  }

  // Remove type: module for CommonJS builds
  delete packageJson.type;

  writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  console.log('[onchain-interactions] Updated package.json for CommonJS');
} else if (process.env.RESTORE_PACKAGE_JSON === 'true') {
  // Restore original package.json
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  if (packageJson._originalType) {
    packageJson.type = packageJson._originalType;
    delete packageJson._originalType;
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log('[onchain-interactions] Restored package.json');
  }
}

console.log('[onchain-interactions] Build completed!');
