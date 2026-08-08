const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * Reasonable fallback USD estimates, used ONLY if the live CoinGecko fetch
 * fails (rate limit, outage, network block). These are deliberately rough
 * and only need to preserve sensible relative ordering (ETH > BNB > POL) --
 * they're never shown to the user, only used internally to decide which
 * chain to sweep first if we can't get live prices.
 */
const FALLBACK_PRICES_USD: Record<string, number> = {
  ethereum: 3000,
  binancecoin: 600,
  'matic-network': 0.5,
};

/**
 * Fetches current USD prices for the given CoinGecko coin ids. Never
 * throws -- on any failure, returns the fallback table instead, so a
 * flaky price API can never block an actual sweep from happening.
 */
export async function fetchNativePricesUsd(coinIds: string[]): Promise<Record<string, number>> {
  const uniqueIds = Array.from(new Set(coinIds));
  try {
    const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${uniqueIds.join(',')}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
    const data = await res.json();

    const result: Record<string, number> = {};
    for (const id of uniqueIds) {
      result[id] = typeof data?.[id]?.usd === 'number' ? data[id].usd : FALLBACK_PRICES_USD[id] ?? 0;
    }
    return result;
  } catch (err) {
    console.warn('CoinGecko price fetch failed, using fallback estimates for sweep ordering only:', err);
    const result: Record<string, number> = {};
    for (const id of uniqueIds) result[id] = FALLBACK_PRICES_USD[id] ?? 0;
    return result;
  }
}
