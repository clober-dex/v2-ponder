import { PRICE_PRECISION } from './tick'

export function unitToBase(
  unitSize: bigint,
  unitAmount: bigint,
  price: bigint,
): bigint {
  if (price === 0n) {
    return 0n
  }
  return (unitAmount * unitSize * PRICE_PRECISION) / price
}

export function unitToQuote(unitSize: bigint, unitAmount: bigint): bigint {
  return unitAmount * unitSize
}
