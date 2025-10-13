export function detectPriceOutliers(
  pricesArray: Array<Record<string, number>>,
  onOutlierCb: (params: { dataSourceName: string; price: number }) => void,
): string[] {
  const outliers: string[] = [];

  const zeroPricesFiltered = pricesArray.filter(priceData => {
    const [exchangeName, price] = Object.entries(priceData)[0];
    if (price === 0 || price < 0 || price === null) {
      onOutlierCb({
        dataSourceName: exchangeName,
        price,
      });
      outliers.push(exchangeName);
      return false;
    }
    return true;
  });

  // Convert array of { Exchange: Price } into a single object { Exchange: Price }
  const prices: Record<string, number> = Object.assign(
    {},
    ...zeroPricesFiltered,
  );
  const exchanges = Object.keys(prices);
  const priceValues = Object.values(prices);

  const sortedPrices = [...priceValues].sort((a, b) => a - b);
  const middle = Math.floor(sortedPrices.length / 2);
  const medianPrice =
    sortedPrices.length % 2 === 0
      ? (sortedPrices[middle - 1] + sortedPrices[middle]) / 2
      : sortedPrices[middle];

  exchanges.forEach(exchange => {
    const price = prices[exchange];
    if (Math.abs(price - medianPrice) / medianPrice > 0.1) {
      onOutlierCb({
        dataSourceName: exchange,
        price,
      });
      outliers.push(exchange);
    }
  });
  return outliers;
}
