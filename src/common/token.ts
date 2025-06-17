import { erc20Abi, getAddress } from 'viem'

import { getStaticDefinition } from './static-token-definition'

export async function fetchTokenSymbol(
  address: `0x${string}`,
  context: { client: any; chain: { id: number } },
): Promise<string> {
  const staticDef = getStaticDefinition(context.chain.id, address)
  if (staticDef) {
    return staticDef.symbol
  }

  try {
    const symbol = await context.client.readContract({
      address: getAddress(address),
      abi: erc20Abi,
      functionName: 'symbol',
    })
    return symbol as string
  } catch {
    return 'unknown'
  }
}

export async function fetchTokenName(
  address: `0x${string}`,
  context: { client: any; chain: { id: number } },
): Promise<string> {
  const staticDef = getStaticDefinition(context.chain.id, address)
  if (staticDef) {
    return staticDef.name
  }

  try {
    const name = await context.client.readContract({
      address: getAddress(address),
      abi: erc20Abi,
      functionName: 'name',
    })
    return name as string
  } catch {
    return 'unknown'
  }
}

export async function fetchTokenDecimals(
  address: `0x${string}`,
  context: { client: any; chain: { id: number } },
): Promise<number | null> {
  const staticDef = getStaticDefinition(context.chain.id, address)
  if (staticDef) {
    return staticDef.decimals
  }

  try {
    const decimals = await context.client.readContract({
      address: getAddress(address),
      abi: erc20Abi,
      functionName: 'decimals',
    })
    const value = Number(decimals)
    return value < 255 ? value : null
  } catch {
    return null
  }
}
