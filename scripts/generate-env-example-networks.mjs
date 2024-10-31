import { networkName, getRpcUrlEnvVar } from '@blocksense/base-utils/evm';
import { kebabToSnakeCase } from '@blocksense/base-utils/string';

const res = networkName.literals
  .map(
    n =>
      `# ${n}` +
      '\n' +
      `${getRpcUrlEnvVar(n)}="<RPC_URL>"` +
      '\n' +
      `EXTRA_SIGNERS_${kebabToSnakeCase(n)}="<EXTRA_SIGNERS>"`,
  )
  .join('\n\n');

console.log(res);
