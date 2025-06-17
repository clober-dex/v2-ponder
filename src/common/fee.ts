import BigNumber from 'bignumber.js'

import { ZERO_BI } from './constants'

export function getFeeRate(feePolicy: number): number {
  const RATE_MASK = 0x7fffffn // 8388607n
  const MAX_FEE_RATE = 500_000n
  const feeBigInt = (BigInt(feePolicy) & RATE_MASK) - MAX_FEE_RATE
  return new BigNumber(feeBigInt.toString())
    .div(new BigNumber('1000000'))
    .toNumber()
}

export function getUsesFeeInQuote(feePolicy: number): boolean {
  return BigInt(feePolicy) >> 23n > ZERO_BI
}
