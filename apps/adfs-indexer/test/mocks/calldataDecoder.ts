import { vi } from 'vitest';

export const INVALID_CALLDATA =
  '0x0100000199ed05b4c4000000010002406c01071234326764357301000000206c00000000000000000000000000000000000000000000000000000000';
export const VALID_CALLDATA =
  '0x0100000199ed1ee3bd000000010002200301071234326764357301000000000300000000000000000000000000000000000000000000000000000000';

vi.mock('@blocksense/contracts/calldata-decoder', () => ({
  decodeADFSCalldata: vi.fn(({ calldata }: { calldata: string }) => ({
    errors: calldata === INVALID_CALLDATA ? ['Invalid calldata'] : [],
  })),
}));
