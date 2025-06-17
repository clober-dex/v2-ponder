import { ponder } from 'ponder:registry'
import { Token, Book } from 'ponder:schema'
import { getAddress } from 'viem'
import BigNumber from 'bignumber.js'

import { ZERO_BD, ZERO_BI } from './common/constants'
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from './common/token'

export function getFeeRate(feePolicy: number): BigNumber {
  const RATE_MASK = 0x7fffffn // 8388607n
  const MAX_FEE_RATE = 500_000n
  const feeBigInt = (BigInt(feePolicy) & RATE_MASK) - MAX_FEE_RATE
  return new BigNumber(feeBigInt.toString()).div(new BigNumber('1000000'))
}

export function getUsesFeeInQuote(feePolicy: number): boolean {
  return BigInt(feePolicy) >> 23n > ZERO_BI
}

ponder.on(
  'BookManager:Open',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const bookId = event.args.id.toString()
    const quoteAddress = getAddress(event.args.quote)
    const baseAddress = getAddress(event.args.base)

    let quote = await context.db.find(Token, {
      address: quoteAddress,
    })
    if (!quote) {
      const symbol = await fetchTokenSymbol(quoteAddress, context)
      const name = await fetchTokenName(quoteAddress, context)
      const decimals = await fetchTokenDecimals(quoteAddress, context)

      if (decimals === null) {
        console.debug('mybug the decimal on token 0 was null')
        return
      }

      await context.db.insert(Token).values({
        address: quoteAddress,
        symbol,
        name,
        decimals,
        priceUSD: ZERO_BD,
      })
      quote = await context.db.find(Token, {
        address: quoteAddress,
      })
    }

    let base = await context.db.find(Token, {
      address: baseAddress,
    })
    if (!base) {
      const symbol = await fetchTokenSymbol(baseAddress, context)
      const name = await fetchTokenName(baseAddress, context)
      const decimals = await fetchTokenDecimals(baseAddress, context)

      if (decimals === null) {
        console.debug('mybug the decimal on token 1 was null')
        return
      }

      await context.db.insert(Token).values({
        address: baseAddress,
        symbol,
        name,
        decimals,
        priceUSD: ZERO_BD,
      })
      base = await context.db.find(Token, {
        address: baseAddress,
      })
    }

    await context.db.insert(Book).values({
      id: bookId,
      createdAtTimestamp: Number(event.block.timestamp),
      createdAtBlockNumber: Number(event.block.number),
      quote: quote.address,
      quoteSymbol: quote.symbol,
      quoteName: quote.name,
      quoteDecimals: quote.decimals,
      base: base.address,
      baseSymbol: base.symbol,
      baseName: base.name,
      baseDecimals: base.decimals,
      unitSize: event.args.unitSize,
      makerPolicy: event.args.makerPolicy,
      makerFee: getFeeRate(event.args.makerPolicy),
      isMakerFeeInQuote: getUsesFeeInQuote(event.args.makerPolicy),
      takerPolicy: event.args.takerPolicy,
      takerFee: getFeeRate(event.args.takerPolicy),
      isTakerFeeInQuote: getUsesFeeInQuote(event.args.takerPolicy),
      hooks: event.args.hooks,
      priceRaw: ZERO_BI,
      price: ZERO_BD,
      inversePrice: ZERO_BD,
      tick: ZERO_BI,
      lastTakenBlockNumber: ZERO_BI,
      lastTakenTimestamp: ZERO_BI,
    })
  },
)

ponder.on(
  'BookManager:Make',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    // Handle the Make event
  },
)

ponder.on(
  'BookManager:Take',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    // Handle the Take event
  },
)

ponder.on(
  'BookManager:Cancel',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    // Handle the Cancel event
  },
)

ponder.on(
  'BookManager:Claim',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    // Handle the Claim event
  },
)

ponder.on(
  'BookManager:Transfer',
  async ({
    event,
    context,
  }: {
    event: any
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    // Handle the Transfer event
  },
)
