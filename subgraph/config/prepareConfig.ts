import * as fs from 'fs'

import { getConfig } from '@squad/lib'

const config = getConfig()
const network: string = config.network ?? ''
if (network === '') {
  throw new Error('Cound not prepare subgraph config. Please set a network in squad-config')
}

// TheGraph is weird and wants to address the local network as mainnet :shrug:
// :/
if (config.network === 'localhost') { config.network = 'mainnet' }

fs.writeFileSync('./config/subgraphConfig.json', JSON.stringify(config))

console.log(`Prepared subgraph config for network: ${network}`)
