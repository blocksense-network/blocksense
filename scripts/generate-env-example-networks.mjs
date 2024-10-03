import { networkName, getRpcUrlEnvVar } from '@blocksense/base-utils/evm';
import { kebabToSnakeCase } from '@blocksense/base-utils/string';

const res = networkName.literals
  .map(
    n =>
      `# ${n}` +
      '\n' +
      `${getRpcUrlEnvVar(n)}="<RPC_URL>"` +
      '\n' +
      `OWNER_ADDRESSES_${kebabToSnakeCase(n)}="<OWNER_ADDRESSES>"`,
  )
  .join('\n\n');

console.log(res);
