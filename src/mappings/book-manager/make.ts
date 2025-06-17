import { ponder } from 'ponder:registry'
import { getAddress } from 'viem'

import { Book, Depth, OpenOrder, Token } from '../../../ponder.schema'
import {
  formatInvertedPrice,
  formatPrice,
  tickToPrice,
} from '../../common/tick'
import { encodeOrderID } from '../../common/order'
import { unitToBase, unitToQuote } from '../../common/amount'
import { ZERO_BI } from '../../common/constants'

const handleMake = ponder.on(
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

export default handleMake
