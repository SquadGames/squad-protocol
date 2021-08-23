import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"

// fetch providers from dev server
const {
  data: { ipfs, ethereum },
} = await axios.get("http://localhost:4040/providers");

if (!ipfs) {
  throw Error("Dev server must be running at port 4040");
}

const client = new Web3ApiClient({
  redirects: [
    {
      from: "ens/ethereum.web3api.eth",
      to: ethereumPlugin({
        networks: {
          testnet: {
            provider: ethereum
          },
          MAINNET: {
            provider: "http://localhost:8546"
          },
        },
        defaultNetwork: "testnet"
      })
    },
    {
      from: "w3://ens/ipfs.web3api.eth",
      to: ipfsPlugin({ provider: ipfs }),
    },
    {
      from: "w3://ens/ens.web3api.eth",
        to: ensPlugin({ addresses: { testnet: ensAddress } }),
    }
  ],
  tracingEnabled: true
})

test("client can query the graph", async () => {
  const response = await client.query(
    uri: 'ens/testnet/squadprotocol.eth',
  )
})
