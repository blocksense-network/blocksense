import yahooFinance from 'yahoo-finance2';

export async function isFeedSupportedByYF(symbol: string) {
  try {
    const quote = await yahooFinance.quote(
      symbol,
      {},
      { validateResult: false },
    );
    if (!quote && Number.isFinite(quote.regularMarketPrice)) {
      console.error(`No quote for symbol: ${symbol}`);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
