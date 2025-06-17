import { ponder } from 'ponder:registry'
import { Token, Book } from 'ponder:schema'
import { getAddress } from 'viem'
import BigNumber from 'bignumber.js'

import { Depth, OpenOrder } from '../ponder.schema'

import { ONE_BI, ZERO_BD, ZERO_BI } from './common/constants'
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from './common/token'
import { formatInvertedPrice, formatPrice, tickToPrice } from './common/tick'
import { encodeOrderID } from './common/order'
import { unitToBase, unitToQuote } from './common/amount'

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
    event: {
      args: {
        id: bigint
        quote: `0x${string}`
        base: `0x${string}`
        unitSize: bigint
        makerPolicy: number
        takerPolicy: number
        hooks: `0x${string}`
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const bookId = event.args.id.toString()
    const quoteAddress = getAddress(event.args.quote)
    const baseAddress = getAddress(event.args.base)

    let [quote, base] = await Promise.all([
      context.db.find(Token, {
        address: quoteAddress,
      }),
      context.db.find(Token, {
        address: baseAddress,
      }),
    ])

    if (!quote) {
      const [symbol, name, decimals] = await Promise.all([
        fetchTokenSymbol(quoteAddress, context),
        fetchTokenName(quoteAddress, context),
        fetchTokenDecimals(quoteAddress, context),
      ])

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

    if (!base) {
      const [name, symbol, decimals] = await Promise.all([
        fetchTokenName(baseAddress, context),
        fetchTokenSymbol(baseAddress, context),
        fetchTokenDecimals(baseAddress, context),
      ])

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
    event: {
      args: {
        bookId: bigint
        user: `0x${string}`
        tick: number
        orderIndex: bigint
        unit: bigint
        provider: `0x${string}`
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const bookId = event.args.bookId.toString()
    const book = await context.db.find(Book, {
      id: bookId,
    })
    if (!book) {
      console.debug(`[MAKE] Book not found: ${bookId}`)
      return
    }
    const [quote, base] = await Promise.all([
      context.db.find(Token, {
        address: getAddress(book.quote),
      }),
      context.db.find(Token, {
        address: getAddress(book.base),
      }),
    ])

    if (quote && base) {
      const tick = BigInt(event.args.tick)
      const priceRaw = tickToPrice(Number(tick))
      const orderID = encodeOrderID(book.id, tick, event.args.orderIndex)

      const quoteAmount = unitToQuote(book.unitSize, event.args.unit)
      const baseAmount = unitToBase(book.unitSize, event.args.unit, priceRaw)

      await context.db.insert(OpenOrder).values({
        id: orderID,
        transaction: event.transaction.hash.toString(),
        timestamp: Number(event.block.timestamp),
        book: book.id,
        unitSize: BigInt(book.unitSize),
        quote: quote.address,
        quoteSymbol: quote.symbol,
        quoteName: quote.name,
        base: base.address,
        baseSymbol: base.symbol,
        baseName: base.name,
        quoteDecimals: quote.decimals,
        origin: getAddress(event.transaction.from),
        owner: getAddress(event.args.user),
        priceRaw,
        tick,
        orderIndex: BigInt(event.args.orderIndex),
        price: formatPrice(priceRaw, base.decimals, quote.decimals),
        inversePrice: formatInvertedPrice(
          priceRaw,
          base.decimals,
          quote.decimals,
        ),
        // initial
        unitAmount: BigInt(event.args.unit),
        baseAmount,
        quoteAmount,
        // filled
        filledUnitAmount: ZERO_BI,
        filledBaseAmount: ZERO_BI,
        filledQuoteAmount: ZERO_BI,
        // claimed
        claimedUnitAmount: ZERO_BI,
        claimedBaseAmount: ZERO_BI,
        claimedQuoteAmount: ZERO_BI,
        // claimable
        claimableUnitAmount: ZERO_BI,
        claimableBaseAmount: ZERO_BI,
        claimableQuoteAmount: ZERO_BI,
        // open
        cancelableUnitAmount: BigInt(event.args.unit),
        cancelableBaseAmount: baseAmount,
        cancelableQuoteAmount: quoteAmount,
      })

      // depth data
      const depthID = book.id.toString().concat('-').concat(tick.toString())
      const depth = await context.db.find(Depth, {
        id: depthID,
      })
      if (!depth) {
        // new depth
        await context.db.insert(Depth).values({
          id: depthID,
          book: book.id,
          tick,
          latestTakenOrderIndex: ZERO_BI,
          unitAmount: BigInt(event.args.unit),
          baseAmount,
          quoteAmount,
          priceRaw,
          price: formatPrice(priceRaw, base.decimals, quote.decimals),
          inversePrice: formatInvertedPrice(
            priceRaw,
            base.decimals,
            quote.decimals,
          ),
        })
      } else {
        // update existing depth
        await context.db.update(Depth, { id: depthID }).set((row: any) => ({
          unitAmount: row.unitAmount + BigInt(event.args.unit),
          baseAmount: row.baseAmount + baseAmount,
          quoteAmount: row.quoteAmount + quoteAmount,
        }))
      }
    } else {
      console.debug(
        `[MAKE] Token not found for book: ${bookId} (${quote?.address}, ${base?.address})`,
      )
      return
    }
  },
)

ponder.on(
  'BookManager:Take',
  async ({
    event,
    context,
  }: {
    event: {
      args: {
        bookId: bigint
        user: `0x${string}`
        tick: number
        unit: bigint
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    if (event.args.unit === 0n) {
      return
    }
    const tick = BigInt(event.args.tick)
    const priceRaw = tickToPrice(Number(tick))
    const book = await context.db.find(Book, {
      id: event.args.bookId.toString(),
    })
    if (!book) {
      console.debug(`[TAKE] Book not found: ${event.args.bookId}`)
      return
    }

    const depthID = event.args.bookId
      .toString()
      .concat('-')
      .concat(tick.toString())
    const [depth, quote, base] = await Promise.all([
      context.db.find(Depth, {
        id: depthID,
      }),
      context.db.find(Token, {
        address: getAddress(book.quote),
      }),
      context.db.find(Token, {
        address: getAddress(book.base),
      }),
    ])
    if (!depth) {
      console.debug(`[TAKE] Depth not found: ${depthID}`)
      return
    }
    if (!quote || !base) {
      console.debug(
        `[TAKE] Token not found for book: ${event.args.bookId} (${quote?.address}, ${base?.address})`,
      )
      return
    }

    const takenUnitAmount = BigInt(event.args.unit)
    const takenBaseAmount = unitToBase(book.unitSize, takenUnitAmount, priceRaw)
    const takenQuoteAmount = unitToQuote(book.unitSize, takenUnitAmount)

    // update book
    await context.db
      .update(Book, { id: event.args.bookId.toString() })
      .set(() => ({
        priceRaw,
        inversePrice: formatInvertedPrice(
          priceRaw,
          base.decimals,
          quote.decimals,
        ),
        tick,
        lastTakenTimestamp: Number(event.block.timestamp),
        lastTakenBlockNumber: Number(event.block.number),
      }))

    // update depth
    await context.db.update(Depth, { id: depthID }).set((row: any) => ({
      unitAmount: row.unitAmount - takenUnitAmount,
      quoteAmount: row.quoteAmount - takenQuoteAmount,
      baseAmount: row.baseAmount - takenBaseAmount,
    }))

    // updateChart(
    //     event.block,
    //     takenBaseAmountDecimal,
    //     takenQuoteAmountDecimal,
    //     book,
    //     base,
    //     quote,
    // )
    let currentOrderIndex = depth.latestTakenOrderIndex
    let remainingTakenUnitAmount = takenUnitAmount
    while (remainingTakenUnitAmount > ZERO_BI) {
      const orderID = encodeOrderID(book.id, tick, currentOrderIndex)
      const openOrder = await context.db.find(OpenOrder, {
        id: orderID.toString(),
      })
      if (!openOrder) {
        currentOrderIndex = currentOrderIndex + ONE_BI
        continue
      }

      const openOrderRemainingUnitAmount =
        BigInt(openOrder.unitAmount) - BigInt(openOrder.filledUnitAmount)
      let filledUnitAmount = ZERO_BI
      if (remainingTakenUnitAmount < openOrderRemainingUnitAmount) {
        filledUnitAmount = remainingTakenUnitAmount
      } else {
        filledUnitAmount = openOrderRemainingUnitAmount
      }

      remainingTakenUnitAmount = remainingTakenUnitAmount - filledUnitAmount

      await context.db
        .update(OpenOrder, { id: orderID.toString() })
        .set((row: any) => {
          const updatedFilledUnitAmount =
            row.filledUnitAmount + filledUnitAmount
          const claimableUnitAfterFill =
            row.claimableUnitAmount + filledUnitAmount
          const remainingCancelableUnitAmount =
            row.cancelableUnitAmount - filledUnitAmount
          return {
            // filled
            filledUnitAmount: updatedFilledUnitAmount,
            filledBaseAmount: unitToBase(
              book.unitSize,
              updatedFilledUnitAmount,
              row.priceRaw,
            ),
            filledQuoteAmount: unitToQuote(
              book.unitSize,
              updatedFilledUnitAmount,
            ),
            // claimable
            claimableUnitAmount: claimableUnitAfterFill,
            claimableBaseAmount: unitToBase(
              book.unitSize,
              claimableUnitAfterFill,
              row.priceRaw,
            ),
            claimableQuoteAmount: unitToQuote(
              book.unitSize,
              claimableUnitAfterFill,
            ),
            // cancelable
            cancelableUnitAmount: remainingCancelableUnitAmount,
            cancelableBaseAmount: unitToBase(
              book.unitSize,
              remainingCancelableUnitAmount,
              row.priceRaw,
            ),
            cancelableQuoteAmount: unitToQuote(
              book.unitSize,
              remainingCancelableUnitAmount,
            ),
          }
        })

      if (openOrder.unitAmount === openOrder.filledUnitAmount) {
        currentOrderIndex = currentOrderIndex + ONE_BI
      }
    }
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
