import { HttpClient, HttpClientRequest } from '@effect/platform';
import { NodeHttpClient } from '@effect/platform-node';
import { runMain } from '@effect/platform-node/NodeRuntime';
import { Config, DateTime, Duration, Effect, Schema as S } from 'effect';
import { toMillis } from 'effect/Duration';

import type { NewFeed } from '@blocksense/config-types';
import { readConfig, writeConfig } from '@blocksense/config-types';

const FmpForexQuote = S.Struct({
  ticker: S.String,
  bid: S.optional(S.Number),
  ask: S.optional(S.Number),
  open: S.optional(S.Number),
  low: S.optional(S.Number),
  high: S.optional(S.Number),
  changes: S.optional(S.Number),
  date: S.optional(S.String),
});
const FmpForexQuoteList = S.Array(FmpForexQuote);

const FmpHistoricalBar = S.Struct({
  date: S.String, // YYYY-MM-DD
  open: S.optional(S.Number),
  high: S.optional(S.Number),
  low: S.optional(S.Number),
  close: S.optional(S.Number),
  volume: S.NullOr(S.Number), // can be missing
});
// Some endpoints return { symbol, historical: [...] }, others (historical-chart) return an array directly.
const FmpHistoricalResponseObject = S.Struct({
  symbol: S.String,
  historical: S.Array(FmpHistoricalBar),
});
const FmpHistoricalVariant = S.Union(
  FmpHistoricalResponseObject,
  S.Array(FmpHistoricalBar),
);

// ---------- Output model ----------
type OutputRow = {
  pair: string; // e.g. "EUR/USD"
  baseCurrency: string; // "EUR"
  baseCurrencyName: string; // "Euro"
  quoteCurrency: string; // "USD"
  quoteCurrencyName: string; // "US Dollar"
  volume: number; // YTD cumulative volume
  days: number; // number of daily bars included
};

// ---------- Helpers ----------
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

function codeToName(code: string): string {
  try {
    const n = currencyNames.of(code);
    // Some non-ISO codes may return the code itself; keep a graceful fallback.
    return typeof n === 'string' ? n : code;
  } catch {
    return code;
  }
}

function splitPair(
  symbol: string,
): { base: string; quote: string; pair: string } | null {
  // Prefer "name" like "EUR/USD" if present.
  if (symbol && symbol.includes('/')) {
    const [b, q] = symbol.split('/');
    const base = (b || '').trim().toUpperCase();
    const quote = (q || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(base) && /^[A-Z]{3}$/.test(quote)) {
      return { base, quote, pair: `${base} / ${quote}` };
    }
  }

  // Fall back to 3+3 split of symbol (common FMP convention, e.g. "EURUSD").
  const s = (symbol || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (/^[A-Z]{6}$/.test(s)) {
    const base = s.slice(0, 3);
    const quote = s.slice(3, 6);
    return { base, quote, pair: `${base} / ${quote}` };
  }

  return null;
}

// ---------- Main Program ----------
const program = Effect.gen(function* () {
  const apiKey = yield* Config.string('FMP_API_KEY');

  const baseUrl = 'https://financialmodelingprep.com';
  const http = yield* HttpClient.HttpClient;
  const client = http.pipe(
    HttpClient.filterStatusOk,
    HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
  );

  // Helpers -------------------------------------------------
  const fetchJson = <A, I>(url: string, schema: S.Schema<A, I>) =>
    client.get(url).pipe(
      Effect.flatMap(res => res.json),
      Effect.flatMap(json => S.decodeUnknown(schema)(json)),
    );

  const fromTo = Effect.map(DateTime.now, nowUtc => {
    const startOfYear = DateTime.startOf(nowUtc, 'year');
    return {
      from: DateTime.formatIsoDateUtc(startOfYear),
      to: DateTime.formatIsoDateUtc(nowUtc),
    };
  });

  const { from, to } = yield* fromTo;
  console.log(
    `Fetching forex quotes with historical data from ${from} to ${to}...`,
  );

  // 1. Fetch all current forex quotes (list of symbols)
  const quotes = yield* fetchJson(
    `/api/v3/fx?apikey=${apiKey}`,
    FmpForexQuoteList,
  );

  // QUOTE (optional)
  const rawQuoteFilter = yield* Config.string('QUOTE');
  const quoteFilter = rawQuoteFilter
    ? rawQuoteFilter.trim().toUpperCase()
    : undefined;

  const quotesAfterQuoteFilter = quoteFilter
    ? quotes.filter(q => {
        const normalized = q.ticker.replace(/[^A-Za-z/]/g, '');
        const split = splitPair(normalized.replace('/', ''), normalized);
        return !!split && split.quote === quoteFilter;
      })
    : quotes;

  const limitVal = yield* Config.integer('FOREX_LIMIT').pipe(
    Config.withDefault(10),
  );
  const filteredQuotes =
    limitVal > 0
      ? quotesAfterQuoteFilter.slice(0, limitVal)
      : quotesAfterQuoteFilter;

  // 2. For each symbol fetch historical daily bars YTD (best-effort, concurrent)
  const rows: OutputRow[] = [];

  yield* Effect.forEach(
    filteredQuotes,
    quote2 =>
      Effect.gen(function* () {
        const split = splitPair(quote2.ticker);
        if (!split) return; // skip malformed symbol
        const { base, pair, quote } = split;

        // Historical endpoint pattern (FMP). Some symbols may not have data or volume.
        // Use historical-chart daily endpoint (includes volume for FX)
        const histUrl = `/api/v3/historical-chart/1day/${base}${quote}?from=${from}&to=${to}&apikey=${apiKey}`;

        const histVariant = yield* fetchJson(
          histUrl,
          FmpHistoricalVariant,
        ).pipe(
          Effect.catchAll(err =>
            Effect.logWarning(
              `Failed historical for ${quote2.ticker}: ${err}`,
            ).pipe(Effect.as(null)),
          ),
        );
        if (!histVariant) return;

        const bars: ReadonlyArray<typeof FmpHistoricalBar.Type> = Array.isArray(
          histVariant,
        )
          ? histVariant
          : (histVariant as { historical: any }).historical;

        // Filter to YTD range (just in case endpoint returns extra days)
        const barsYtd = bars.filter(
          b =>
            b.date && b.date.slice(0, 10) >= from && b.date.slice(0, 10) <= to,
        );
        if (barsYtd.length === 0) return; // skip if no data

        const ytdVol = barsYtd.reduce(
          (acc, bar) => acc + (typeof bar.volume === 'number' ? bar.volume : 0),
          0,
        );
        const days = barsYtd.length;
        rows.push({
          pair,
          baseCurrency: base,
          baseCurrencyName: codeToName(base),
          quoteCurrency: quote,
          quoteCurrencyName: codeToName(quote),
          volume: ytdVol,
          days,
        });
      }),
    { concurrency: 10 },
  );

  // 3. Sort by YTD volume desc; tie-breaker alphabetical pair
  rows.sort((a, b) => b.volume - a.volume || a.pair.localeCompare(b.pair));

  // 4. Add idx field to each row
  const indexedRows = rows.map((row, idx) => ({ idx, ...row }));

  // 5. Output JSON array
  yield* Effect.sync(() => {
    process.stdout.write(
      JSON.stringify(
        {
          from,
          to,
          generatedAt: new Date().toISOString(),
          count: indexedRows.length,
          quoteFilter: quoteFilter ?? null,
          indexedRows,
        },
        null,
        2,
      ),
    );
    process.stdout.write('\n');
  });

  const feedsConfig = yield* Effect.tryPromise(() =>
    readConfig('feeds_config_v2'),
  );

  const FOREX_FEED_ID_START = 10_000n;

  const newFeeds = indexedRows.map(
    (row): NewFeed => ({
      id: FOREX_FEED_ID_START + BigInt(row.idx),
      description: `Price of ${row.baseCurrencyName} in ${row.quoteCurrencyName}`,
      full_name: row.pair,
      type: 'price-feed',
      oracle_id: 'forex-price-feeds',
      value_type: 'numerical',
      stride: 0,
      quorum: {
        percentage: 75,
        aggregation: 'median',
      },
      schedule: {
        interval_ms: toMillis(Duration.minutes(1)),
        heartbeat_ms: toMillis(Duration.hours(2)),
        deviation_percentage: 0.5,
        first_report_start_unix_time_ms: 0,
      },
      additional_feed_info: {
        pair: {
          base: row.baseCurrency,
          quote: row.quoteCurrency,
        },
        decimals: 8,
        category: 'Forex',
        market_hours: 'Forex',
        arguments: {
          kind: 'forex-price-feeds',
          providers: ['twelvedata', 'YahooFinance', 'AlphaVantage'],
        },
        compatibility_info: undefined,
      },
    }),
  );

  const allFeeds = [...feedsConfig.feeds, ...newFeeds].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  yield* Effect.tryPromise(() =>
    writeConfig('feeds_config_v2', {
      feeds: allFeeds,
    }),
  );
});

// Provide Node HttpClient and run.
program.pipe(Effect.provide(NodeHttpClient.layer), runMain);
