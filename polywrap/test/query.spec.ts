import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"
import { graphNodePlugin } from "@web3api/graph-node-plugin-js"
import axios from 'axios'

jest.setTimeout(120000)

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

let client: Web3ApiClient
beforeAll(async () => {
  client = await getClient()
})

test("client can query the graph", async () => {
  const response = await client.query({
    uri: '/ens/testnet/squadprotocol.eth',
    query: `query queryGraphNode {
queryGraphNode(query: "{squadNFTs {id}}")
}`
  })
  expect(response.errors).toBe(undefined)
  expect(response?.data?.queryGraphNode).toBe('{"data":{"squadNFTs":[]}}')
})
