#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import packageJson from '../package.json'
import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from '@web3api/ethereum-plugin-js'
import { ipfsPlugin } from '@web3api/ipfs-plugin-js'
import { ensPlugin } from '@web3api/ens-plugin-js'
import axios from 'axios'
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  gql
} from '@apollo/client'

import fetch from 'cross-fetch'

import { getConfig, getSecrets } from '@squad/lib'
import { ethers, Contract, Transaction } from 'ethers'

import * as fs from 'fs'

const apollo = new ApolloClient({
  link: new HttpLink({
    uri: 'http://localhost:8000/subgraphs/name/squadgames/squad-POC-subgraph',
    fetch
  }),
  cache: new InMemoryCache()
})

// TODO don't hardcode localhost network
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')

async function getPolywrap (signer: number = 0) {
  // fetch providers from dev server
  const {
    data: { ipfs, ethereum }
  } = await axios.get('http://localhost:4040/providers')

  if (ipfs === undefined) {
    throw Error('Dev server must be running at port 4040')
  }

  const ensConfig = await axios.get('http://localhost:4040/ens')
  const ensAddress = ensConfig.data.ensAddress

  return new Web3ApiClient({
    plugins: [
      {
        uri: '/ens/ens.web3api.eth',
        plugin: ensPlugin({
          addresses: {
            testnet: ensAddress
          }
        })
      },
      {
        uri: '/ens/ethereum.web3api.eth',
        plugin: ethereumPlugin({
          networks: {
            testnet: {
              provider: ethereum,
              signer: signer
            }
          },
          // If defaultNetwork is not specified, mainnet will be used.
          defaultNetwork: 'testnet'
        })
      },
      {
        uri: '/ens/ipfs.web3api.eth',
        plugin: ipfsPlugin({
          provider: ipfs
        })
      }
    ]
  })
}

const squadUri = '/ens/testnet/squadprotocol.eth'

// TODO support standard wallet storage format
async function getWallet (): Promise<ethers.Wallet> {
  const secrets = await getSecrets()
  const config = await getConfig()
  if (secrets.cliPrivateKey === undefined) {
    console.error(
      `No private key found in ~/.squad/${config.network as string}-secrets.json.`
    )
    console.error('using new random key')
    return ethers.Wallet.createRandom()
  }
  return new ethers.Wallet(secrets.cliPrivateKey)
}

// TODO support data files in CLI
function getMedium (media: string): string {
  try {
    new URL(media)
    return 'URI'
  } catch {}

  const ext = media.split('.').pop() ?? ''
  if ([
    'json',
    'txt',
    'yaml',
    'yml',
    'toml',
    'ini'
  ].includes(ext)) {
    return 'UTF8_FILE'
  }

  throw new Error(
    'Unsupported medium expected URI or json, txt, yaml, yml, toml, or ini file'
  )
}

export async function version (): Promise<string> {
  return packageJson.version
}

export async function registerRevShareContent (): Promise<string> {
  throw new Error('Not Implemented')
}

function handleMedia (
  media: string,
  medium: string = 'auto',
  hash: string = 'auto'
): { media: string, medium: string, hash: string } {
  if (medium === 'auto') {
    medium = getMedium(media)
  }

  if (medium === 'UTF8_FILE') {
    media = fs.readFileSync(media).toString()
    medium = 'UTF8_STRING'
  }

  if (medium === 'URI' && hash === 'auto') {
    throw new Error('URI medium, missing hash')
  }

  if (medium === 'UTF8_STRING' && hash === 'auto') {
    hash = ethers.utils.keccak256(Buffer.from(media))
  }

  return { media, medium, hash }
}

export async function registerPurchasableContent (
  content: string,
  metadata: string,
  sharePercentage: number,
  price: number,
  data: string,
  contentMedium: string = 'auto',
  metadataMedium: string = 'auto',
  contentHash: string = 'auto',
  metadataHash: string = 'auto'
): Promise<string> {
  try {
    const parsedData = JSON.parse(data)
    if (parsedData.type === undefined) {
      throw new Error('missing type field')
    }
    if (parsedData.underlyingWorks === undefined) {
      throw new Error('missing underlyingWorks')
    }
  } catch (e) {
    throw new Error(`invalid data: ${data} ${e}`)
  }

  const wallet = await getWallet()
  const config = await getConfig()
  const _content = handleMedia(content, contentMedium, contentHash)
  const _metadata = handleMedia(metadata, metadataMedium, metadataHash)

  const query = gql`
          mutation registerPurchasableContent {
            registerPurchasableContent(
              creatorAddress: $creatorAddress
              licenseManagerAddress: $licenseManagerAddress
              content: $content
              contentMedium: $contentMedium
              contentHash: $contentHash
              metadata: $metadata
              metadataMedium: $metadataMedium
              metadataHash: $metadataHash
              registrant: $registrant
              sharePercentage: $sharePercentage
              price: $price
              data: $data
            )
          }`

  const variables = {
    creatorAddress: wallet.address,
    licenseManagerAddress: config.contracts.PurchasableLicenseManager.address,
    registrant: wallet.address,
    sharePercentage: sharePercentage.toString(),
    price: price.toString(),
    data,
    content: _content.media,
    contentMedium: _content.medium,
    contentHash: _content.hash,
    metadata: _metadata.media,
    metadataMedium: _metadata.medium,
    metadataHash: _metadata.hash
  }

  const polywrap = await getPolywrap()
  const response = await polywrap.query<{
    registerPurchasableContent: Transaction//TxResponse
  }>({ uri: squadUri, query, variables })
  if (response.errors !== undefined) {
    throw new Error(response.errors.join('\n\n'))
  }

  // TODO make abis available in config
  const NFTRegisteredAbi = 'NFTRegistered(address,uint256,address,uint256,uint8,address,string)'
  const txHash: string = response.data?.registerPurchasableContent.hash ?? ''
  const tx = await provider.getTransaction(txHash)
  await tx.wait()
  const contract = new Contract(
    config.contracts.PurchasableLicenseManager.address,
    [`event ${NFTRegisteredAbi}`],
    provider
  )
  const filter = contract.filters.NFTRegistered!()
  const rawLogs = await provider.getLogs(filter)
  const logs = rawLogs.map(l => contract.interface.parseLog(l))
  // TODO make register functions time independant (not dependant on latest logs)
  let latestMatch
  for (const i in logs) {
    const log = logs[i]
    if (log === undefined) {
      throw new Error('never')
    }
    const [
      loggedNftAddress,
      loggedNftId,
      loggedRegistrant,
      loggedPrice,
      loggedSharePercentage,
      loggedLicenseTokenAddress,
      loggedData
    ] = log.args
    if (loggedData === data &&
        loggedRegistrant === wallet.address &&
        loggedPrice.eq(price) &&
        loggedSharePercentage === sharePercentage
    ) {
      latestMatch = log.args
    }
  }
  if (latestMatch === undefined || latestMatch.length !== 7) {
    throw new Error(`Failed to find log of registration, got ${latestMatch}`)
  } else {
    return latestMatch.join(' ')
  }
}

// TODO specify the Content type
type Content = any

function displayContent (content: Content) {
  return `${content.__typename} ${content.type} ${content.id}` +
    `${content.underlyingWorks.length > 0 ? ' derivative' : ''}` +
    `${content.revShareLicenses.length > 0 ? ' deriveable' : ''}` +
    `${content.purchasableLicenses.length > 0 ? ' purchasable' : ''}`
}

export interface ContentInput {
  first?: number
  skip?: number
  _type?: string
  nftAddress?: string
  nftId?: number
  id?: string
}

export async function content ({
  first = 100,
  skip = 0,
  _type,
  nftAddress,
  nftId,
  id
}: ContentInput): Promise<string> {
  const query = gql`
    query Contents(
      $first: Int,
      $skip: Int,
      $type: String,
      $nftAddress: String,
      $id: String,
    ) {
      contents (
        first: $first
        skip: $skip
        where: {
          ${_type ? 'type: $type' : ''}
          ${nftAddress ? 'nftAddress: $nftAddress' : ''}
          ${id ? 'id: $id' : ''}
        }
      ) {
        id
        nftAddress
        nftId
        type
        underlyingWorks {
          id
        }
        purchasableLicenses {
   	  id
        }
        revShareLicenses {
          id
        }
      }
    }`
  const response = await apollo.query<{ contents: Content[]}>({
    query: query,
    variables: { first, skip, type: _type, nftAddress, id }
  })

  return response.data.contents.map(displayContent).join('\n')
}

async function help(): Promise<string> {
  return `help command not yet implemented, try one of ${Object.keys(commands)}`
}

const commands = {
  version,
  "register-purchasable": registerPurchasableContent,
  content,
  help
}

