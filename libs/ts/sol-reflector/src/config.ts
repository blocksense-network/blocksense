import { OutputFormat } from './types';

export interface ReflectConfig {
  /**
   * The directory where rendered pages will be written.
   * Defaults to 'docs'.
   */
  outputDir?: string;

  /**
   * An array of sources subdirectories that should be excluded from
   * documentation, relative to the contract sources directory.
   */
  exclude?: string[];

  /**
   * The format to use for the generated documentation.
   */
  format?: OutputFormat;
}

////////////////////////////////////////////////////////////////////////////////////////////////////

// Other config parameters that will be provided by the environment (e.g. Hardhat)
// rather than by the user manually, unless using the library directly.
export interface Config extends ReflectConfig {
  /**
   * The root directory relative to which 'outputDir', 'sourcesDir', and
   * 'templates' are specified. Defaults to the working directory.
   */
  root?: string;

  /**
   * The Solidity sources directory.
   */
  sourcesDir?: string;
}

export type FullConfig = Required<Config>;

export const defaults: Omit<FullConfig, 'templates'> = {
  root: process.cwd(),
  sourcesDir: 'contracts',
  outputDir: 'docs',
  exclude: [],
  format: OutputFormat.Both,
};
