import fs from 'fs'

import { getAddress, isAddress, isAddressEqual, zeroAddress } from 'viem'

type TokenDefinition = {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
}

// Helper for hardcoded tokens
export const getStaticDefinition = (
  chainId: number,
  tokenAddress: `0x${string}`,
): TokenDefinition | null => {
  const filePath = `./tokens/${chainId}.json`
  const staticDefinitions = (
    fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      : []
  ) as TokenDefinition[]
  tokenAddress = getAddress(tokenAddress)
  if (isAddressEqual(tokenAddress, zeroAddress)) {
    return (
      staticDefinitions.find((def) =>
        isAddressEqual(def.address, zeroAddress),
      ) || null
    )
  }

  // Search the definition using the address
  for (let i = 0; i < staticDefinitions.length; i++) {
    const staticDefinition = staticDefinitions[i]
    if (
      staticDefinition &&
      isAddress(staticDefinition.address) &&
      isAddressEqual(staticDefinition.address, tokenAddress)
    ) {
      return staticDefinition
    }
  }

  // If not found, return null
  return null
}
