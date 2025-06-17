import { ponder } from 'ponder:registry'
import { getAddress } from 'viem'

import { decodeBookIDFromOrderID } from '../../common/order'
import { Book, Depth, OpenOrder, Token } from '../../../ponder.schema'
import { tickToPrice } from '../../common/tick'
import { unitToBase, unitToQuote } from '../../common/amount'

const handleCancel = ponder.on(
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

export default handleCancel
