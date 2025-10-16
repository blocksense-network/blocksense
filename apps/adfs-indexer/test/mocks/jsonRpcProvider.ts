import { vi } from 'vitest';

type Listener = {
  event: any;
  handler: (payload: any) => any | Promise<any>;
};

export class MockJsonRpcProvider {
  private listeners: Listener[] = [];

  getBlockNumber = vi.fn().mockResolvedValue(123);
  getLogs = vi.fn().mockResolvedValue([]);
  getTransaction = vi.fn().mockResolvedValue(null);

  on = vi.fn((event: any, handler: Listener['handler']) => {
    this.listeners.push({ event, handler });
    return this;
  });

  off = vi.fn((event: any, handler: Listener['handler']) => {
    this.listeners = this.listeners.filter(
      listener => listener.event !== event || listener.handler !== handler,
    );
    return this;
  });

  async emit(event: any, payload: any) {
    const matchingListeners = this.listeners.filter(
      listener => listener.event === event,
    );

    for (const listener of matchingListeners) {
      await listener.handler(payload);
    }
  }

  async emitBlock(blockNumber: number) {
    await this.emit('block', blockNumber);
  }

  async emitLog(payload: { transactionHash: string; blockNumber: number }) {
    const logListeners = this.listeners.filter(
      listener =>
        listener.event !== null &&
        typeof listener.event === 'object' &&
        !Array.isArray(listener.event),
    );

    if (logListeners.length === 0) {
      throw new Error('No log listeners registered on mock provider');
    }

    for (const listener of logListeners) {
      await listener.handler(payload);
    }
  }
}
