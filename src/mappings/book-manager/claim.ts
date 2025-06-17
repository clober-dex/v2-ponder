import { ponder } from 'ponder:registry'
import { getAddress } from 'viem'

import { decodeBookIDFromOrderID } from '../../common/order'
import { Book, OpenOrder, Token } from '../../../ponder.schema'
import { tickToPrice } from '../../common/tick'
import { unitToBase, unitToQuote } from '../../common/amount'

const handleClaim = ponder.on(
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

export default handleClaim
