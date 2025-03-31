import { networkName, getRpcUrlEnvVar } from '@blocksense/base-utils/evm';
import { kebabToScreamingSnakeCase } from '@blocksense/base-utils/string';

const res = networkName.literals
  .map(n =>
    [
      `# ${n}`,
      `${getRpcUrlEnvVar(n)}="<RPC_URL>"`,
      `REPORTER_ADDRESSES_${kebabToScreamingSnakeCase(n)}="<REPORTERS>"`,
      `ADMIN_EXTRA_SIGNERS_${kebabToScreamingSnakeCase(n)}="<EXTRA_SIGNERS>"`,
      `${kebabToScreamingSnakeCase(n)}_API_KEY="<API_KEY>"`,
    ].join('\n'),
  )
  .join('\n\n');

console.log(res);
