import { vi } from 'vitest';

let jsonRpcProviderMock: ReturnType<typeof vi.fn> = vi.fn(() => {
  throw new Error('Mock JsonRpcProvider not initialised');
});

const mockProviderKey = '__mockJsonRpcProvider';

export const setMockProvider = (provider: any | undefined) => {
  if (provider) {
    (globalThis as any)[mockProviderKey] = provider;
  } else {
    delete (globalThis as any)[mockProviderKey];
  }
};

vi.mock('ethers', async () => {
  const actual = await vi.importActual<any>('ethers');

  jsonRpcProviderMock = vi.fn(() => {
    const provider = (globalThis as any)[mockProviderKey];
    if (!provider) {
      throw new Error('Mock JsonRpcProvider not set');
    }
    return provider;
  });

  return {
    ...actual,
    JsonRpcProvider: jsonRpcProviderMock,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jsonRpcProviderMock,
    },
  };
});

export { jsonRpcProviderMock };
