import { onchainTable } from 'ponder'

export const Token = onchainTable('Token', (t) => ({
  address: t.hex().primaryKey(),
  symbol: t.text().notNull(),
  name: t.text().notNull(),
  decimals: t.integer().notNull(),
}))

export const Book = onchainTable('Book', (t) => ({
  // immutable values
  // book id
  id: t.bigint().primaryKey(),
  // creation
  createdAtTimestamp: t.bigint().notNull(),
  // block book was created at
  createdAtBlockNumber: t.bigint().notNull(),
  // quote token
  quote: t.hex().notNull(),
  quoteSymbol: t.text().notNull(),
  quoteName: t.text().notNull(),
  quoteDecimals: t.integer().notNull(),
  // base token
  base: t.hex().notNull(),
  baseSymbol: t.text().notNull(),
  baseName: t.text().notNull(),
  baseDecimals: t.integer().notNull(),
  // unit size
  unitSize: t.bigint().notNull(),
  // maker policy
  makerPolicy: t.bigint().notNull(),
  // maker fee
  makerFee: t.real().notNull(),
  isMakerFeeInQuote: t.boolean().notNull(),
  // taker policy
  takerPolicy: t.bigint().notNull(),
  // taker fee
  takerFee: t.real().notNull(),
  isTakerFeeInQuote: t.boolean().notNull(),
  // hooks
  hooks: t.hex().notNull(),

  // mutable values
  // current price tracker
  priceRaw: t.bigint().notNull(),
  // quote per base
  price: t.real().notNull(),
  // base per quote
  inversePrice: t.real().notNull(),
  // current tick
  tick: t.bigint().notNull(),
  // last taken timestamp
  lastTakenTimestamp: t.bigint().notNull(),
  // last taken block number
  lastTakenBlockNumber: t.bigint().notNull(),
}))

export const Depth = onchainTable('Depth', (t) => ({
  id: t.text().primaryKey(),
  book: t.bigint().notNull(),
  tick: t.bigint().notNull(),
  priceRaw: t.bigint().notNull(),

  price: t.real().notNull(),
  inversePrice: t.real().notNull(),
  unitAmount: t.bigint().notNull(),
  baseAmount: t.bigint().notNull(),
  quoteAmount: t.bigint().notNull(),
  latestTakenOrderIndex: t.bigint().notNull(),
}))

export const OpenOrder = onchainTable('OpenOrder', (t) => ({
  // immutable values
  // orderId
  id: t.bigint().primaryKey(),
  // which txn the make was included in
  transaction: t.hex().notNull(),
  // time of txn
  timestamp: t.bigint().notNull(),
  // book position is within
  book: t.bigint().notNull(),
  unitSize: t.bigint().notNull(),
  // allow indexing by tokens
  quote: t.hex().notNull(),
  quoteSymbol: t.text().notNull(),
  quoteName: t.text().notNull(),
  quoteDecimals: t.numeric().notNull(),
  // allow indexing by tokens
  base: t.hex().notNull(),
  baseSymbol: t.text().notNull(),
  baseName: t.text().notNull(),
  baseDecimals: t.numeric().notNull(),
  // txn origin
  origin: t.hex().notNull(),
  // current price tracker
  priceRaw: t.bigint().notNull(),
  // current tick
  tick: t.bigint().notNull(),
  // current order index
  orderIndex: t.bigint().notNull(),
  // quote per base
  price: t.real().notNull(),
  // base per quote
  inversePrice: t.real().notNull(),
  // mutable values
  // owner of position where liquidity made to
  owner: t.hex().notNull(),
  // order size (descending when cancel)
  unitAmount: t.bigint().notNull(),
  baseAmount: t.bigint().notNull(),
  quoteAmount: t.bigint().notNull(),
  // filled (ascending when taken)
  filledUnitAmount: t.bigint().notNull(),
  filledBaseAmount: t.bigint().notNull(),
  filledQuoteAmount: t.bigint().notNull(),
  // claimed (descending when claim)
  claimedUnitAmount: t.bigint().notNull(),
  claimedBaseAmount: t.bigint().notNull(),
  claimedQuoteAmount: t.bigint().notNull(),
  // claimable (ascending when taken)
  claimableUnitAmount: t.bigint().notNull(),
  claimableBaseAmount: t.bigint().notNull(),
  claimableQuoteAmount: t.bigint().notNull(),
  // cancelable (descending when fill or cancel)
  cancelableUnitAmount: t.bigint().notNull(),
  cancelableBaseAmount: t.bigint().notNull(),
  cancelableQuoteAmount: t.bigint().notNull(),
}))

export const ChartLog = onchainTable('ChartLog', (t) => ({
  id: t.text().primaryKey(),
  base: t.hex().notNull(),
  quote: t.hex().notNull(),
  marketCode: t.text().notNull(),
  intervalType: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  open: t.real().notNull(),
  high: t.real().notNull(),
  low: t.real().notNull(),
  close: t.real().notNull(),
  baseVolume: t.real().notNull(),
  bidBookBaseVolume: t.real().notNull(),
  askBookBaseVolume: t.real().notNull(),
}))
