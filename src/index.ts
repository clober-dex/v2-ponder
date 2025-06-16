import { ponder } from 'ponder:registry'
import { Token, Book } from 'ponder:schema'
import { getAddress } from 'viem'

import { ZERO_BD } from './common/constants'
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from './common/token'

const RATE_MASK = 0x7fffffn // 8388607n
const MAX_FEE_RATE = 500_000n
const FEE_PRECISION = new BigNumber(1_000_000)
const ZERO_BI = 0n

export function getFeeRate(feePolicy: number): BigNumber {
  const feeBigInt = (BigInt(feePolicy) & RATE_MASK) - MAX_FEE_RATE
  return new BigNumber(feeBigInt.toString()).div(FEE_PRECISION)
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
    context: { db: any; client: any }
  }) => {
    const bookId = event.params.id.toString()
    const quoteAddress = getAddress(event.params.quote)
    const baseAddress = getAddress(event.params.base)

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
      data: {
        createdAtTimestamp: Number(event.block.timestamp),
        createdAtBlockNumber: Number(event.block.number),
        quote: quote.id,
        base: base.id,
        unitSize: event.params.unitSize,
        makerPolicy: event.params.makerPolicy,
        makerFee: getFeeRate(event.params.makerPolicy),
        isMakerFeeInQuote: getUsesFeeInQuote(event.params.makerPolicy),
        takerPolicy: event.params.takerPolicy,
        takerFee: getFeeRate(event.params.takerPolicy),
        isTakerFeeInQuote: getUsesFeeInQuote(event.params.takerPolicy),
        hooks: event.params.hooks,
        priceRaw: ZERO_BI,
        price: ZERO_BD,
        inversePrice: ZERO_BD,
        tick: ZERO_BI,
        lastTakenBlockNumber: ZERO_BI,
        lastTakenTimestamp: ZERO_BI,
      },
    })
  },
)

ponder.on('BookManager:Make', async ({ event, context }) => {
  // Handle the Make event
})

ponder.on('BookManager:Take', async ({ event, context }) => {
  // Handle the Take event
})

ponder.on('BookManager:Cancel', async ({ event, context }) => {
  // Handle the Cancel event
})

ponder.on('BookManager:Claim', async ({ event, context }) => {
  // Handle the Claim event
})

ponder.on('BookManager:Transfer', async ({ event, context }) => {
  // Handle the Transfer event
})
