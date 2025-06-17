import { ponder } from 'ponder:registry'
import { formatUnits, getAddress } from 'viem'

import {
  formatInvertedPrice,
  formatPrice,
  tickToPrice,
} from '../../common/tick'
import { Book, ChartLog, Depth, OpenOrder, Token } from '../../../ponder.schema'
import { unitToBase, unitToQuote } from '../../common/amount'
import {
  CHART_LOG_INTERVALS,
  encodeChartLogID,
  encodeMarketCode,
} from '../../common/chart'
import { ONE_BI, ZERO_BI } from '../../common/constants'
import { encodeOrderID } from '../../common/order'

const handleTake = ponder.on(
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
    const takenBaseAmountDecimal = Number(
      formatUnits(BigInt(takenBaseAmount), Number(base.decimals)),
    )
    const takenQuoteAmount = unitToQuote(book.unitSize, takenUnitAmount)
    const takenQuoteAmountDecimal = Number(
      formatUnits(BigInt(takenQuoteAmount), Number(quote.decimals)),
    )

    // update book
    await context.db
      .update(Book, { id: event.args.bookId.toString() })
      .set(() => ({
        priceRaw,
        price: formatPrice(priceRaw, base.decimals, quote.decimals),
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
          timestamp: Number(timestampForAcc),
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
          timestamp: Number(timestampForAcc),
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

export default handleTake
