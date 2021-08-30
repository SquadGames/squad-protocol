import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"
import { graphNodePlugin } from "@web3api/graph-node-plugin-js"
import axios from 'axios'
import { getConfig } from '@squad/lib'
import { ethers, providers } from 'ethers'

// TODO move this TxResponse interface to lib
interface TxResponse {
  hash: string;
  to?: string;
  from: string;
  nonce: number;
  gasLimit: string;
  gasPrice: string;
  data: string;
  value: string;
  chainId: number;
  blockNumber?: string;
  blockHash?: string;
  timestamp?: number;
  confirmations: number;
  raw?: string;
  r?: string;
  s?: string;
  v?: number;
  type?: number;
  accessList?: Access[];
}

export interface Access {
  address: string;
  storageKeys: string[];
}

jest.setTimeout(120000)

const config = getConfig()
console.log("testing polywrap querise with config...")
console.log(config)

async function getClient() {
  // fetch providers from dev server
  const {
    data: { ipfs, ethereum },
  } = await axios.get("http://localhost:4040/providers");

  if (!ipfs) {
    throw Error("Dev server must be running at port 4040");
  }

  const ensConfig = await axios.get("http://localhost:4040/ens")
  const ensAddress = ensConfig.data.ensAddress

  return new Web3ApiClient({
    plugins: [
      {
        uri: "/ens/ens.web3api.eth",
        plugin: ensPlugin({
          addresses: {
            testnet: ensAddress
          }
        })
      },
      {
        uri: "/ens/ethereum.web3api.eth",
        plugin: ethereumPlugin({
          networks: {
            testnet: {
              provider: ethereum,
              signer: 0
            }
          },
          // If defaultNetwork is not specified, mainnet will be used.
          defaultNetwork: "testnet"
        })
      },
      {
        uri: "/ens/ipfs.web3api.eth",
        plugin: ipfsPlugin({
          provider: "http://ipfs.io",
          fallbackProviders: [ipfs]
        }),
      },
      {
        uri: 'ens/graph-node.web3api.eth',
        plugin: graphNodePlugin({
          provider: "http://localhost:8000"
        })
      }
    ]
  })
}

// maybe make a library funciton for querying squad polywrap that
// fills in this extra stuff and knows about all the contract
// addresses
const squadUri = '/ens/testnet/squadprotocol.eth'

describe("Squad Content Registrarion", () => {

  let client: Web3ApiClient
  let ethersProvider: providers.JsonRpcProvider
  let creator: string
  beforeAll(async () => {
    client = await getClient()
    ethersProvider = ethers.providers.getDefaultProvider("http://localhost:8546") as providers.JsonRpcProvider
    creator = await ethersProvider.getSigner().getAddress()
  })

  test("Registers existing NFT as purchasable", async () => {
    // Set up
    // mint an NFT to register
    const NFTresponse = await client.query({
      uri: squadUri,
      query: `
        mutation {
          mintNFT(
            contractAddress: $contractAddress
            creatorAddress: $creatorAddress
            content: $content
            metadata: $metadata
          )
      }`,
      variables: {
        contractAddress: config.contracts.ERC721Squad.address,
        creatorAddress: creator,
        content: "my cool NFT",
        metadata: "{ cool: true }",
        extraVariable: "test",
      }
    })
    if (NFTresponse.errors) {
      throw NFTresponse.errors
    }

    // execute the query
    const response = await client.query({
      uri: squadUri,
      query: `
        mutation {
          registerPurchasableNFTContent(
            nftAddress: $nftAddress
            nftId: $nftId
            registrant: $registrant
            data: $data
            licenseManagerAddress: $licenseManagerAddress
            price: $price
            sharePercentage: $sharePercentage
          )
        }
      `,
      variables: {
        nftAddress: config.contracts.PurchasableLicenseManager.address
      }
    })

    // confirm the expected response

  })
})

