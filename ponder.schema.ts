import { onchainTable } from 'ponder'

export const Token = onchainTable('Token', (t) => ({
  address: t.text().primaryKey(),
  symbol: t.text(),
  name: t.text(),
  decimals: t.bigint(),
}))

export const Book = onchainTable('Book', (t) => ({
  id: t.text().primaryKey(),
  createdAtTimestamp: t.bigint(),
  createdAtBlockNumber: t.bigint(),
  quote: t.text(),
  quoteSymbol: t.text(),
  quoteName: t.text(),
  quoteDecimals: t.numeric(),
  base: t.text(),
  baseSymbol: t.text(),
  baseName: t.text(),
  baseDecimals: t.numeric(),
  unitSize: t.bigint(),
  makerPolicy: t.bigint(),
  makerFee: t.numeric(),
  isMakerFeeInQuote: t.boolean(),
  takerPolicy: t.bigint(),
  takerFee: t.numeric(),
  isTakerFeeInQuote: t.boolean(),
  hooks: t.text(),
  priceRaw: t.bigint(),
  price: t.numeric(),
  inversePrice: t.numeric(),
  tick: t.bigint(),
  lastTakenTimestamp: t.bigint(),
  lastTakenBlockNumber: t.bigint(),
}))

export const Depth = onchainTable('Depth', (t) => ({
  id: t.text().primaryKey(),
  book: t.text(),
  tick: t.bigint(),
  priceRaw: t.bigint(),
  price: t.numeric(),
  inversePrice: t.numeric(),
  unitAmount: t.bigint(),
  baseAmount: t.bigint(),
  quoteAmount: t.bigint(),
  latestTakenOrderIndex: t.bigint(),
}))

export const OpenOrder = onchainTable('OpenOrder', (t) => ({
  // immutable values
  // orderId
  id: t.text().primaryKey(),
  // which txn the make was included in
  transaction: t.text(),
  // time of txn
  timestamp: t.bigint(),
  // book position is within
  book: t.text(),
  // allow indexing by tokens
  quote: t.text(),
  quoteSymbol: t.text(),
  quoteName: t.text(),
  quoteDecimals: t.numeric(),
  // allow indexing by tokens
  base: t.text(),
  baseSymbol: t.text(),
  baseName: t.text(),
  baseDecimals: t.numeric(),
  // txn origin
  origin: t.text(),
  // current price tracker
  priceRaw: t.bigint(),
  // current tick
  tick: t.bigint(),
  // current order index
  orderIndex: t.bigint(),
  // quote per base
  price: t.numeric(),
  // base per quote
  inversePrice: t.numeric(),
  // mutable values
  // owner of position where liquidity made to
  owner: t.text(),
  // order size (descending when cancel)
  unitAmount: t.bigint(),
  baseAmount: t.bigint(),
  quoteAmount: t.bigint(),
  // filled (ascending when taken)
  filledUnitAmount: t.bigint(),
  filledBaseAmount: t.bigint(),
  filledQuoteAmount: t.bigint(),
  // claimed (descending when claim)
  claimedUnitAmount: t.bigint(),
  claimedBaseAmount: t.bigint(),
  claimedQuoteAmount: t.bigint(),
  // claimable (ascending when taken)
  claimableUnitAmount: t.bigint(),
  claimableBaseAmount: t.bigint(),
  claimableQuoteAmount: t.bigint(),
  // cancelable (descending when fill or cancel)
  cancelableUnitAmount: t.bigint(),
  cancelableBaseAmount: t.bigint(),
  cancelableQuoteAmount: t.bigint(),
}))

export const ChartLog = onchainTable('ChartLog', (t) => ({
  id: t.text().primaryKey(),
  base: t.text(),
  quote: t.text(),
  marketCode: t.text(),
  intervalType: t.text(),
  timestamp: t.bigint(),
  open: t.numeric(),
  high: t.numeric(),
  low: t.numeric(),
  close: t.numeric(),
  baseVolume: t.numeric(),
  bidBookBaseVolume: t.numeric(),
  askBookBaseVolume: t.numeric(),
}))
