import { ponder } from 'ponder:registry'
import { getAddress, isAddressEqual, zeroAddress } from 'viem'

import { OpenOrder } from '../../../ponder.schema'

const handleTransfer = ponder.on(
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

export default handleTransfer
