import { ponder } from 'ponder:registry'
import { getAddress } from 'viem'

import { Book, Token } from '../../../ponder.schema'
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
} from '../../common/token'
import { getFeeRate, getUsesFeeInQuote } from '../../common/fee'
import { ZERO_BI } from '../../common/constants'

const handleOpen = ponder.on(
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
      price: 0,
      inversePrice: 0,
      tick: ZERO_BI,
      lastTakenBlockNumber: ZERO_BI,
      lastTakenTimestamp: ZERO_BI,
    })
  },
)

export default handleOpen
