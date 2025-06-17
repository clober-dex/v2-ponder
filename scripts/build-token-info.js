import fs from 'fs'

import yargs from 'yargs'
import { getAddress } from 'viem'

async function main() {
  const argv = yargs(process.argv.slice(2))
    .option('subgraph', {
      alias: 's',
      description: 'Subgraph to build for fetching token address',
      type: 'string',
      demandOption: true,
    })
    .option('chainId', {
      alias: 'c',
      description: 'Chain ID to build for',
      type: 'number',
      demandOption: true,
    })
    .help().argv

  const chainId = argv.chainId
  const response = await fetch(argv.subgraph, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        tokens {
          id
          name
          symbol
          decimals
        }
      }`,
    }),
  })
  const {
    data: { tokens },
  } = await response.json()

  fs.writeFileSync(
    `${chainId}-tokens.json`,
    JSON.stringify(
      tokens.map((token) => ({
        address: getAddress(token.id),
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
      })),
    ),
  )
  console.log(
    `Token info for chain ID ${chainId} has been written to ${chainId}-tokens.json`,
  )
}

main()
