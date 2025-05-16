import { networkName, getRpcUrlEnvVar } from '@blocksense/base-utils/evm';
import { kebabToSnakeCase } from '@blocksense/base-utils/string';

const res = networkName.literals
  .map(n =>
    [
      `# ${n}`,
      `${getRpcUrlEnvVar(n)}="<RPC_URL>"`,
      `REPORTER_ADDRESSES_${kebabToSnakeCase(n)}="<REPORTERS>"`,
      `ADMIN_EXTRA_SIGNERS_${kebabToSnakeCase(n)}="<EXTRA_SIGNERS>"`,
      `${kebabToSnakeCase(n)}_API_KEY="<API_KEY>"`,
    ].join('\n'),
  )
  .join('\n\n');

console.log(res);
