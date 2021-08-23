import { Web3ApiClient } from '@web3api/client-js'

const client = new Web3ApiClient()

async function main() {
  const res = client.query({
    uri: "api",
    query: `query queryGraphNode {
queryGraphNode(query: "{  squadNFTs {    creator    blockCreated  }}")
}`
  })
  return res
}

main().then(console.log).catch(console.error)

