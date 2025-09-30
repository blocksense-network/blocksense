import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { detectPriceOutliers } from './outliers-detector';

describe('`data-providers.ts` tests', () => {
  let onOutlierCb: (params: { dataSourceName: string; price: number }) => void;

  beforeEach(() => {
    onOutlierCb = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return an empty array when no exchange has >10% price difference', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 0.19244 },
      { BinanceUS: 0.19246 },
      { Bitget: 0.1924 },
      { Bybit: 0.19243 },
      { Coinbase: 0.19226 },
      { CryptoCom: 0.19278 },
      { GateIo: 0.19245 },
      { KuCoin: 0.19247 },
      { MEXC: 0.19248 },
      { OKX: 0.1924 },
    ];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return an empty array for an edge case with exactly 10% difference', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 1 },
      { Bitget: 1.1 },
    ];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return an empty array when price difference is slightly below 10%', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 30000 },
      { Bitget: 32999 },
      { Bybit: 31000 },
    ];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should handle floating-point precision issues near 10% threshold', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 30000 },
      { Bitget: 33000.0000001 },
      { Bybit: 31000 },
    ];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return an array with one outliner', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 0 },
      { Bitget: 0.01014 },
      { Bybit: 0.01009 },
      { GateIo: 0.0101 },
      { KuCoin: 0.01012 },
      { MEXC: 0.010165 },
    ];

    const expectedResult: string[] = ['Binance'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });

  test('should return an array with two outliners', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 0 },
      { BinanceUS: 0.01154 },
      { Bitget: 0.01014 },
      { Bybit: 0.01009 },
      { GateIo: 0.0101 },
      { KuCoin: 0.01012 },
      { MEXC: 0.010165 },
    ];
    const expectedResult: string[] = ['Binance', 'BinanceUS'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });

  test('should return an empty array when no exchanges are listed for an asset', () => {
    const input: Array<Record<string, number>> = [];

    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return an empty array when all exchanges have the same price', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 2000 },
      { Bitget: 2000 },
      { Bybit: 2000 },
      { KuCoin: 2000 },
    ];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return an empty array when an asset has only one exchange', () => {
    const input: Array<Record<string, number>> = [{ Binance: 30000 }];
    const expectedResult: string[] = [];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).not.toHaveBeenCalled();
  });

  test('should return array with all exchanges when all exchanges have a price of 0', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 0 },
      { Bitget: 0 },
      { Bybit: 0 },
    ];
    const expectedResult: string[] = ['Binance', 'Bitget', 'Bybit'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });

  test('should detect outlier with extremely large price differences', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 30000 },
      { Bitget: 330000 },
      { Bybit: 31000 },
    ];
    const expectedResult: string[] = ['Bitget'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });

  test('should handle negative prices and detect outliers', () => {
    const input: Array<Record<string, number>> = [
      { Binance: -30000 },
      { Bitget: -33000 },
      { Bybit: -31000 },
    ];
    const expectedResult: string[] = ['Binance', 'Bitget', 'Bybit'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });

  test('should handle mixed positive and negative prices and detect outliers', () => {
    const input: Array<Record<string, number>> = [
      { Binance: 30000 },
      { Bitget: -33000 },
      { Bybit: 31000 },
    ];
    const expectedResult: string[] = ['Bitget'];
    const result = detectPriceOutliers(input, onOutlierCb);
    expect(result).toEqual(expectedResult);
    expect(onOutlierCb).toHaveBeenCalled();
  });
});
