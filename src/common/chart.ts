export const CHART_LOG_INTERVALS: Record<string, number> = {
  '1m': 60,
  '3m': 3 * 60,
  '5m': 5 * 60,
  '10m': 10 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1h': 60 * 60,
  '2h': 2 * 60 * 60,
  '4h': 4 * 60 * 60,
  '6h': 6 * 60 * 60,
  '1d': 24 * 60 * 60,
  '1w': 7 * 24 * 60 * 60,
}

export function encodeMarketCode(
  base: `0x${string}`,
  quote: `0x${string}`,
): string {
  return base.concat('-').concat(quote)
}
export function encodeChartLogID(
  base: `0x${string}`,
  quote: `0x${string}`,
  intervalType: string,
  timestamp: number,
): string {
  const marketCode = encodeMarketCode(base, quote)
  return marketCode
    .concat('-')
    .concat(intervalType)
    .concat('-')
    .concat(timestamp.toString())
}
