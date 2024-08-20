import fs from 'fs';
import { execSync } from 'child_process';

// This script is run before Hardhat environment is loaded to build the dependencies if not already built

// Define the path to the dist folders
const distBaseUtilsFolderPath = '../base-utils/dist';
const distSolReflectFolderPath = '../sol-reflector/dist';

// Check if the dist folders exist
if (
  !fs.existsSync(distBaseUtilsFolderPath) ||
  !fs.existsSync(distSolReflectFolderPath)
) {
  try {
    // Run the yarn build:deps command
    execSync('yarn build:deps', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to build dependencies. Exiting...');
    process.exit(1);
  }
}
