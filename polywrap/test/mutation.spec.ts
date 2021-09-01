import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"
import { graphNodePlugin } from "@web3api/graph-node-plugin-js"
import axios from 'axios'
import { getConfig } from '@squad/lib'
import { ethers } from 'ethers'

// TODO move TxResponse interface from tests to lib
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

const NFTRegisteredAbi = "NFTRegistered(address,uint256,address,uint256,uint8,address,string)"
const NFTUnregisteredAbi = "NFTUnregistered(address,uint256)"
const PurchaseAbi = "Purchase(address,uint256,address,uint256,uint256,address)"



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
          provider: ipfs
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

// TODO maybe make a library funciton for querying squad polywrap
// fills in this extra stuff and knows about all the contract
// addresses
const squadUri = '/ens/testnet/squadprotocol.eth'

describe("Squad Content Registrarion", () => {

  let client: Web3ApiClient
  let provider: ethers.providers.JsonRpcProvider
  let creator: string
  beforeAll(async () => {
    client = await getClient()
    provider = new ethers.providers.JsonRpcProvider("http://localhost:8545")
    creator = await provider.getSigner().getAddress()
  })

  test("Registers existing NFT as purchasable", async () => {
    // Set up
    // mint an NFT to register
    const mintResponse = await client.query<{mintNFT: TxResponse}> ({
      uri: squadUri,
      query: `
        mutation mintNFT {
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
      }
    })
    if (mintResponse.errors) {
      throw mintResponse.errors
    }

    // Okay, we've minted an NFT and now we need the ID in order to
    // register it.  Where is that id and how can we know it's the one
    // we just made? We can look at the logs from the transaction
    const mintTxHash = mintResponse.data?.mintNFT?.hash
    if (mintTxHash === undefined) {
      throw new Error("undefined mint tx hash")
    }
    const tokenMintedAbi = "TokenMinted(uint256,address,string,string,bytes32,bytes32)"
    const mintLogs = await provider.getLogs({
      address: config.contracts.ERC721Squad.address,
      topics: [ethers.utils.id(tokenMintedAbi)],
    })

    expect(mintLogs.length).toBe(1)

    const rawMintLog = mintLogs[0]
    if (rawMintLog === undefined) {
      throw new Error("expected mintLogs to be length 1")
    }
    const tokenMintedInterface = new ethers.utils.Interface(
      [`event ${tokenMintedAbi}`]
    )
    const mintLog = tokenMintedInterface.parseLog(rawMintLog)
    expect(mintLog.name).toBe("TokenMinted")
    expect(mintLog.args[1]).toBe(creator)

    const nftId = mintLog.args[0].toNumber()
    const price = 5
    const sharePercentage = 75
    const data = ' { "type": "[(some edn data (oooohh))]", "number": 1 }'
    const nftAddress = config.contracts.ERC721Squad.address
    const registrant = creator
    const licenseManagerAddress = config.contracts.PurchasableLicenseManager.address

    // execute the query
    const registerResponse = await client.query({
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
        nftAddress,
        nftId: nftId.toString(),
        registrant,
        data,
        licenseManagerAddress,
        price: price.toString(),
        sharePercentage: sharePercentage.toString(),
      }
    })

    expect(registerResponse.errors).toBe(undefined)

    // confirm the expected response
    const registerLogs = await provider.getLogs({
      address: config.contracts.PurchasableLicenseManager.address,
      topics: [ethers.utils.id(NFTRegisteredAbi)],
    })

    expect(registerLogs.length).toBe(1)

    const rawRegisterLog = registerLogs[0]
    if (rawRegisterLog === undefined) {
      throw new Error("expected registerLogs to be length 1")
    }
    const NFTRegisteredInterface = new ethers.utils.Interface(
      [`event ${NFTRegisteredAbi}`]
    )
    const registerLog = NFTRegisteredInterface.parseLog(rawRegisterLog)
    expect(registerLog.name).toBe("NFTRegistered")
    const [
      loggedNftAddress,
      loggedNftId,
      loggedRegistrant,
      loggedPrice,
      loggedSharePercentage,
      loggedLicenseTokenAddress,
      loggedData,
    ] = registerLog.args

    expect(loggedNftAddress).toBe(nftAddress)
    expect(loggedNftId.toNumber()).toBe(nftId)
    expect(loggedRegistrant).toBe(registrant)
    expect(loggedPrice.toNumber()).toBe(price)
    expect(loggedSharePercentage).toBe(sharePercentage)
    expect(loggedData).toBe(data)
  })
})

