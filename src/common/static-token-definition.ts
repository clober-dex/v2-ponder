import { getAddress, isAddress, isAddressEqual, zeroAddress } from 'viem'

import {
  NATIVE_TOKEN_DEFINITION,
  STATIC_TOKEN_DEFINITIONS,
  TokenDefinition,
} from './chain'

// Helper for hardcoded tokens
export const getStaticDefinition = (
  tokenAddress: `0x${string}`,
): TokenDefinition | null => {
  const staticDefinitions = STATIC_TOKEN_DEFINITIONS
  tokenAddress = getAddress(tokenAddress)
  if (isAddressEqual(tokenAddress, zeroAddress)) {
    return NATIVE_TOKEN_DEFINITION
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
