import { createConfig } from 'ponder'

import { BookManagerAbi } from './abis/BookManager'

export default createConfig({
  chains: {
    'monad-testnet': {
      id: 10143,
      rpc: process.env.MONAD_TESTNET_RPC || 'https://testnet-rpc.monad.xyz',
    },
    'rise-sepolia': {
      id: 11155931,
      rpc: process.env.RISE_SEPOLIA_RPC || 'https://testnet.riselabs.xyz',
    },
  },
  contracts: {
    BookManager: {
      chain: 'monad-testnet',
      abi: BookManagerAbi,
      address: '0xAA9575d63dFC224b9583fC303dB3188C08d5C85A',
      startBlock: 3196033,
    },
  },
})
