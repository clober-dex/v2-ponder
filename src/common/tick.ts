import BigNumber from 'bignumber.js'

BigNumber.config({
  DECIMAL_PLACES: 100,
})

const R = [
  BigInt('79220240490215316061937756560'), // 0xfff97272373d413259a46990
  BigInt('79212319258289487113226433916'), // 0xfff2e50f5f656932ef12357c
  BigInt('79196479170490597288862688490'), // 0xffe5caca7e10e4e61c3624ea
  BigInt('79164808496886665658930780291'), // 0xffcb9843d60f6159c9db5883
  BigInt('79101505139923049997807806614'), // 0xff973b41fa98c081472e6896
  BigInt('78975050245229982702767995059'), // 0xff2ea16466c96a3843ec78b3
  BigInt('78722746600537056721934508529'), // 0xfe5dee046a99a2a811c461f1
  BigInt('78220554859095770638340573243'), // 0xfcbe86c7900a88aedcffc83b
  BigInt('77225761753129597550065289036'), // 0xf987a7253ac413176f2b074c
  BigInt('75273969370139069689486932537'), // 0xf3392b0822b70005940c7a39
  BigInt('71517125791179246722882903167'), // 0xe7159475a2c29b7443b29c7f
  BigInt('64556580881331167221767657719'), // 0xd097f3bdfd2022b8845ad8f7
  BigInt('52601903197458624361810746399'), // 0xa9f746462d870fdf8a65dc1f
  BigInt('34923947901690145425342545398'), // 0x70d869a156d2a1b890bb3df6
  BigInt('15394552875315951095595078917'), // 0x31be135f97d08fd981231505
  BigInt('2991262837734375505310244436'), // 0x9aa508b5b7a84e1c677de54
  BigInt('112935262922445818024280873'), // 0x5d6af8dedb81196699c329
  BigInt('160982827401375763736068'), // 0x2216e584f5fa1ea92604
  BigInt('327099227039063106'), // 0x48a170391f7dc42
  BigInt('1350452'), // 0x149b34
] as const

export const PRICE_PRECISION = 96n

export function tickToPrice(tick: number): bigint {
  if (tick > 524287 || tick < -524287) {
    throw new Error('Invalid tick')
  }

  const absTick = BigInt(Math.abs(tick))
  let price: bigint = (absTick & 1n) !== 0n ? R[0] : 1n << 96n

  for (let i = 1; i < 19; i++) {
    if ((absTick & (1n << BigInt(i))) !== 0n) {
      price = (price * R[i]!) >> 96n
    }
  }

  if (tick > 0) {
    const max = 6277101735386680763835789423207666416102355444464034512896n
    price = max / price
  }

  return price
}

export function formatPrice(
  price: bigint,
  baseDecimals: number,
  quoteDecimals: number,
): string {
  return new BigNumber(price.toString())
    .div(new BigNumber(2).pow(PRICE_PRECISION.toString()))
    .times(new BigNumber(10).pow(baseDecimals))
    .div(new BigNumber(10).pow(quoteDecimals))
    .toFixed()
}

export function formatInvertedPrice(
  price: bigint,
  baseDecimals: number,
  quoteDecimals: number,
): string {
  if (price === 0n) {
    return '0'
  }
  return new BigNumber(1)
    .div(formatPrice(price, quoteDecimals, baseDecimals))
    .toFixed()
}
