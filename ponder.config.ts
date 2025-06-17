import { createConfig } from 'ponder'
import { monadTestnet, riseTestnet } from 'viem/chains'

import { BookManagerAbi } from './abis/BookManager'

const CHAIN_MAP: {
  [key: number]: {
    name: string
    rpc: string
    contracts: {
      BookManager: {
        chain: string
        abi: any
        address: `0x${string}`
        startBlock: number
      }
    }
  }
} = {
  [monadTestnet.id]: {
    name: 'monad-testnet',
    rpc: process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz',
    contracts: {
      BookManager: {
        chain: 'monad-testnet',
        abi: BookManagerAbi,
        address: '0xAA9575d63dFC224b9583fC303dB3188C08d5C85A',
        startBlock: 3196033,
      },
    },
  },
  [riseTestnet.id]: {
    name: 'rise-sepolia',
    rpc: process.env.RISE_SEPOLIA_RPC || 'https://testnet.riselabs.xyz',
    contracts: {
      BookManager: {
        chain: 'rise-sepolia',
        abi: BookManagerAbi,
        address: '0xBc6eaFe723723DED3a411b6a1089a63bc5d73568',
        startBlock: 7969941,
      },
    },
  },
}

const chainId = Number(process.env.CHAIN_ID || monadTestnet.id)
const CHAIN = CHAIN_MAP[chainId as keyof typeof CHAIN_MAP]
if (!CHAIN) {
  throw new Error(`Unsupported chain ID: ${chainId}`)
}

export default createConfig({
  chains: {
    [CHAIN.name]: {
      id: chainId,
      rpc: CHAIN.rpc,
    },
  },
  ...CHAIN.contracts,
})
