export function encodeOrderID(
  bookID: string,
  tick: bigint,
  orderIndex: bigint,
): bigint {
  const bookIDBigInt = BigInt(bookID)

  // tickU24 = truncate to 24 bits
  const tickU24 = BigInt(Number(tick & BigInt(0xffffff))) // 24 bits mask

  const shift40 = BigInt(2) ** BigInt(40)
  const shift64 = BigInt(2) ** BigInt(64)

  return orderIndex + tickU24 * shift40 + bookIDBigInt * shift64
}

export function decodeBookIDFromOrderID(orderID: bigint): string {
  const shift64 = BigInt(2) ** BigInt(64)
  return (orderID / shift64).toString()
}

export function getPendingUnitAmount(openOrder: {
  cancelableUnitAmount: bigint
  claimableUnitAmount: bigint
}): bigint {
  return openOrder.cancelableUnitAmount + openOrder.claimableUnitAmount
}
