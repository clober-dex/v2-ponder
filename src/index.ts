import { ponder } from 'ponder:registry'
import { formatUnits, getAddress, isAddressEqual, zeroAddress } from 'viem'

import { Book, ChartLog, Depth, OpenOrder, Token } from '../ponder.schema'

import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from './common/token'
import { getFeeRate, getUsesFeeInQuote } from './common/fee'
import { ONE_BI, ZERO_BI } from './common/constants'
import { formatInvertedPrice, formatPrice, tickToPrice } from './common/tick'
import { decodeBookIDFromOrderID, encodeOrderID } from './common/order'
import { unitToBase, unitToQuote } from './common/amount'
import {
  CHART_LOG_INTERVALS,
  encodeChartLogID,
  encodeMarketCode,
} from './common/chart'

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
      })
      base = await context.db.find(Token, {
        address: baseAddress,
      })
    }

    await context.db.insert(Book).values({
      id: BigInt(bookId),
      createdAtTimestamp: BigInt(event.block.timestamp),
      createdAtBlockNumber: BigInt(event.block.number),
      quote: quote.address,
      quoteSymbol: quote.symbol,
      quoteName: quote.name,
      quoteDecimals: Number(quote.decimals),
      base: base.address,
      baseSymbol: base.symbol,
      baseName: base.name,
      baseDecimals: Number(base.decimals),
      unitSize: BigInt(event.args.unitSize),
      makerPolicy: BigInt(event.args.makerPolicy),
      makerFee: getFeeRate(event.args.makerPolicy),
      isMakerFeeInQuote: getUsesFeeInQuote(event.args.makerPolicy),
      takerPolicy: BigInt(event.args.takerPolicy),
      takerFee: getFeeRate(event.args.takerPolicy),
      isTakerFeeInQuote: getUsesFeeInQuote(event.args.takerPolicy),
      hooks: getAddress(event.args.hooks),
      priceRaw: ZERO_BI,
      price: 0,
      inversePrice: 0,
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
    const bookId = event.args.bookId
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
        transaction: event.transaction.hash.toString() as `0x${string}`,
        timestamp: BigInt(event.block.timestamp),
        book: BigInt(book.id),
        unitSize: BigInt(book.unitSize),
        quote: quote.address,
        quoteSymbol: quote.symbol,
        quoteName: quote.name,
        quoteDecimals: Number(quote.decimals),
        base: base.address,
        baseSymbol: base.symbol,
        baseName: base.name,
        baseDecimals: Number(base.decimals),
        origin: getAddress(event.transaction.from),
        owner: getAddress(event.args.user),
        priceRaw,
        tick,
        orderIndex: BigInt(event.args.orderIndex),
        price: Number(formatPrice(priceRaw, base.decimals, quote.decimals)),
        inversePrice: Number(
          formatInvertedPrice(priceRaw, base.decimals, quote.decimals),
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
          book: BigInt(book.id),
          tick,
          latestTakenOrderIndex: ZERO_BI,
          unitAmount: BigInt(event.args.unit),
          baseAmount,
          quoteAmount,
          priceRaw,
          price: Number(formatPrice(priceRaw, base.decimals, quote.decimals)),
          inversePrice: Number(
            formatInvertedPrice(priceRaw, base.decimals, quote.decimals),
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
    const bookId = BigInt(event.args.bookId)
    const book = await context.db.find(Book, {
      id: bookId,
    })
    if (!book) {
      console.debug(`[TAKE] Book not found: ${bookId}`)
      return
    }

    const depthID = bookId.toString().concat('-').concat(tick.toString())
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
    const takenBaseAmountDecimal = Number(
      formatUnits(BigInt(takenBaseAmount), Number(base.decimals)),
    )
    const takenQuoteAmount = unitToQuote(book.unitSize, takenUnitAmount)
    const takenQuoteAmountDecimal = Number(
      formatUnits(BigInt(takenQuoteAmount), Number(quote.decimals)),
    )

    // update book
    await context.db.update(Book, { id: bookId }).set(() => ({
      priceRaw,
      price: Number(formatPrice(priceRaw, base.decimals, quote.decimals)),
      inversePrice: Number(
        formatInvertedPrice(priceRaw, base.decimals, quote.decimals),
      ),
      tick,
      lastTakenTimestamp: BigInt(event.block.timestamp),
      lastTakenBlockNumber: BigInt(event.block.number),
    }))

    // update depth
    await context.db.update(Depth, { id: depthID }).set((row: any) => ({
      unitAmount: row.unitAmount - takenUnitAmount,
      quoteAmount: row.quoteAmount - takenQuoteAmount,
      baseAmount: row.baseAmount - takenBaseAmount,
    }))

    for (let i = 0; i < Object.keys(CHART_LOG_INTERVALS).length; i++) {
      const intervalType = Object.keys(CHART_LOG_INTERVALS)[i]!
      const intervalInNumber = CHART_LOG_INTERVALS[intervalType]!
      const timestampForAcc = Math.floor(
        (Number(event.block.timestamp) / intervalInNumber) * intervalInNumber,
      )

      // natural chart log
      const chartLogID = encodeChartLogID(
        base.address,
        quote.address,
        intervalType,
        timestampForAcc,
      )
      const invertedChartLogID = encodeChartLogID(
        quote.address,
        base.address,
        intervalType,
        timestampForAcc,
      )

      const marketCode = encodeMarketCode(base.address, quote.address)
      const invertedMarketCode = encodeMarketCode(quote.address, base.address)
      const [chartLog, invertedChartLog] = await Promise.all([
        context.db.find(ChartLog, {
          id: chartLogID,
        }),
        context.db.find(ChartLog, {
          id: invertedChartLogID,
        }),
      ])

      if (!chartLog) {
        await context.db.insert(ChartLog).values({
          id: chartLogID,
          marketCode,
          base: base.address,
          quote: quote.address,
          intervalType,
          timestamp: BigInt(timestampForAcc),
          open: book.price,
          high: book.price,
          low: book.price,
          close: book.price,
          baseVolume: takenBaseAmountDecimal,
          bidBookBaseVolume: takenBaseAmountDecimal,
          askBookBaseVolume: 0,
        })
      } else {
        await context.db
          .update(ChartLog, { id: chartLogID })
          .set((row: any) => {
            return {
              high: book.price > row.high ? book.price : row.high,
              low: book.price < row.low ? book.price : row.low,
              close: book.price,
              baseVolume: row.baseVolume + takenBaseAmountDecimal,
              bidBookBaseVolume: row.bidBookBaseVolume + takenBaseAmountDecimal,
            }
          })
      }

      if (!invertedChartLog) {
        await context.db.insert(ChartLog).values({
          id: invertedChartLogID,
          marketCode: invertedMarketCode,
          base: quote.address,
          quote: base.address,
          intervalType,
          timestamp: BigInt(timestampForAcc),
          open: book.inversePrice,
          high: book.inversePrice,
          low: book.inversePrice,
          close: book.inversePrice,
          baseVolume: takenQuoteAmountDecimal,
          bidBookBaseVolume: 0,
          askBookBaseVolume: takenQuoteAmountDecimal,
        })
      } else {
        await context.db
          .update(ChartLog, { id: invertedChartLogID })
          .set((row: any) => {
            return {
              high: book.inversePrice > row.high ? book.inversePrice : row.high,
              low: book.inversePrice < row.low ? book.inversePrice : row.low,
              close: book.inversePrice,
              baseVolume: row.baseVolume + takenQuoteAmountDecimal,
              askBookBaseVolume:
                row.askBookBaseVolume + takenQuoteAmountDecimal,
            }
          })
      }
    }

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
  'BookManager:Claim',
  async ({
    event,
    context,
  }: {
    event: {
      args: {
        orderId: bigint
        unit: bigint
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const unit = BigInt(event.args.unit)
    if (unit === 0n) {
      return
    }
    const bookID = decodeBookIDFromOrderID(event.args.orderId)
    const orderID = event.args.orderId.toString()
    const [book, openOrder] = await Promise.all([
      context.db.find(Book, {
        id: bookID,
      }),
      context.db.find(OpenOrder, {
        id: orderID,
      }),
    ])
    if (!openOrder) {
      console.debug(`[CLAIM] Open order not found: ${orderID}`)
      return
    }
    if (!book) {
      console.debug(`[CLAIM] Book not found: ${bookID}`)
      return
    }

    const [base, quote] = await Promise.all([
      context.db.find(Token, {
        address: getAddress(book.base),
      }),
      context.db.find(Token, {
        address: getAddress(book.quote),
      }),
    ])
    if (base && quote) {
      const priceRaw = tickToPrice(Number(openOrder.tick))

      const quoteAmount = unitToQuote(book.unitSize, unit)
      const baseAmount = unitToBase(book.unitSize, unit, priceRaw)

      await context.db.update(OpenOrder, { id: orderID }).set((row: any) => {
        return {
          // claimed
          claimedUnitAmount: row.claimedUnitAmount + unit,
          claimedBaseAmount: row.claimedBaseAmount + baseAmount,
          claimedQuoteAmount: row.claimedQuoteAmount + quoteAmount,
          // claimable
          claimableUnitAmount: row.claimableUnitAmount - unit,
          claimableBaseAmount: row.claimableBaseAmount - baseAmount,
          claimableQuoteAmount: row.claimableQuoteAmount - quoteAmount,
        }
      })

      if (
        openOrder.cancelableUnitAmount + openOrder.claimableUnitAmount ===
        0n
      ) {
        await context.db.delete(OpenOrder, { id: orderID })
      }
    } else {
      console.debug(
        `[CLAIM] Token not found for book: ${bookID} (${quote?.address}, ${base?.address})`,
      )
      return
    }
  },
)

ponder.on(
  'BookManager:Cancel',
  async ({
    event,
    context,
  }: {
    event: {
      args: {
        orderId: bigint
        unit: bigint
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const unit = BigInt(event.args.unit)
    if (unit === 0n) {
      return
    }
    const bookID = decodeBookIDFromOrderID(event.args.orderId)
    const orderID = event.args.orderId.toString()
    const [book, openOrder] = await Promise.all([
      context.db.find(Book, {
        id: bookID,
      }),
      context.db.find(OpenOrder, {
        id: orderID,
      }),
    ])
    if (!openOrder) {
      console.debug(`[CANCEL] Open order not found: ${orderID}`)
      return
    }
    if (!book) {
      console.debug(`[CANCEL] Book not found: ${bookID}`)
      return
    }

    const [base, quote] = await Promise.all([
      context.db.find(Token, {
        address: getAddress(book.base),
      }),
      context.db.find(Token, {
        address: getAddress(book.quote),
      }),
    ])
    if (base && quote) {
      const priceRaw = tickToPrice(Number(openOrder.tick))

      const quoteAmount = unitToQuote(book.unitSize, unit)
      const baseAmount = unitToBase(book.unitSize, unit, priceRaw)

      await context.db.update(OpenOrder, { id: orderID }).set((row: any) => {
        return {
          unitAmount: row.unitAmount - unit,
          quoteAmount: row.quoteAmount - quoteAmount,
          baseAmount: row.baseAmount - baseAmount,
          // cancelable
          cancelableUnitAmount: row.cancelableUnitAmount - unit,
          cancelableQuoteAmount: row.cancelableQuoteAmount - quoteAmount,
          cancelableBaseAmount: row.cancelableBaseAmount - baseAmount,
        }
      })

      // depth data
      await context.db
        .update(Depth, {
          id: bookID.concat('-').concat(openOrder.tick.toString()),
        })
        .set((row: any) => ({
          unitAmount: row.unitAmount - unit,
          quoteAmount: row.quoteAmount - quoteAmount,
          baseAmount: row.baseAmount - baseAmount,
        }))

      if (
        openOrder.cancelableUnitAmount + openOrder.claimableUnitAmount ===
        0n
      ) {
        await context.db.delete(OpenOrder, { id: orderID })
      }
    } else {
      console.debug(
        `[CANCEL] Token not found for book: ${bookID} (${quote?.address}, ${base?.address})`,
      )
      return
    }
  },
)

ponder.on(
  'BookManager:Transfer',
  async ({
    event,
    context,
  }: {
    event: {
      args: {
        from: `0x${string}`
        to: `0x${string}`
        tokenId: bigint
      }
      block: { timestamp: bigint; number: bigint }
      transaction: { hash: string; from: `0x${string}` }
    }
    context: { db: any; client: any; chain: { id: number } }
  }) => {
    const from = getAddress(event.args.from)
    const to = getAddress(event.args.to)
    const orderID = event.args.tokenId.toString()

    if (isAddressEqual(from, zeroAddress) || isAddressEqual(to, zeroAddress)) {
      // mint or burn events are handled in the make, cancel, and claim events
      return
    }
    const openOrder = await context.db.find(OpenOrder, {
      id: orderID,
    })
    if (!openOrder) {
      console.debug(`[TRANSFER] Open order not found: ${orderID}`)
      return
    }

    await context.db.update(OpenOrder, { id: orderID }).set(() => ({
      owner: to,
    }))
  },
)
