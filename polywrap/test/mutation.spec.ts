import { Web3ApiClient } from '@web3api/client-js'
import { ethereumPlugin } from "@web3api/ethereum-plugin-js"
import { ipfsPlugin } from "@web3api/ipfs-plugin-js"
import { ensPlugin } from "@web3api/ens-plugin-js"
import { graphNodePlugin } from "@web3api/graph-node-plugin-js"
import axios from 'axios'
import { getConfig } from '@squad/lib'
import { ethers, Contract } from 'ethers'
import * as crypto from 'crypto'

const NFTRegisteredAbi = "NFTRegistered(address,uint256,address,uint256,uint8,address,string)"
const NFTUnregisteredAbi = "NFTUnregistered(address,uint256)"
const PurchaseAbi = "Purchase(address,uint256,address,uint256,uint256,address)"

async function unique(): Promise<string> {
  const b = await crypto.randomBytes(256)
  return `UINQUE-${b.toString('hex')}`
}

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

describe("Squad Content Network", () => {

  let client: Web3ApiClient
  let provider: ethers.providers.JsonRpcProvider
  let creator: string
  let purchaser: string
  beforeAll(async () => {
    client = await getClient()
    provider = new ethers.providers.JsonRpcProvider("http://localhost:8545")
    creator = await provider.getSigner().getAddress()
    purchaser = await provider.getSigner(1).getAddress()
  })

  let snapshotId: string
  beforeEach(async () => {
    snapshotId = await provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await provider.send('evm_revert', [snapshotId])
  })

  test("Registers new NFTs for rev share content", async () => {
    const result = await client.query<{ registerPurchasableContent: TxResponse }>({
      uri: squadUri,
      query: `
          mutation registerRevShareContent {
            registerRevShareContent(
              creatorAddress: $creatorAddress
              licenseManagerAddress: $licenseManagerAddress
              content: $content
              contentMedium: $contentMedium
              metadata: $metadata
              metadataMedium: $metadataMedium
              registrant: $registrant
              minSharePercentage: $minSharePercentage
              data: $data
            )
          }`,
      variables: {
        creatorAddress: creator,
        licenseManagerAddress: config.contracts.RevShareLicenseManager.address,
        content: "sweet content",
        contentMedium: "UTF8_STRING",
        metadata: " { metameta }",
        metadataMedium: "UTF8_STRING",
        registrant: creator,
        minSharePercentage: "10",
        data: ' { "test": true }',
      }
    })
    expect(result.errors).toBeUndefined()
  })

  test("Registers new NFTs for new purchasable content", async () => {
    // Set up
    const newB64Content: String = Buffer.from("MockRawFileData").toString("base64")
    const creatorAddress = creator
    const registrant = creator
    const price = 4
    const sharePercentage = 20

    interface TestCase {
      variables: any
      expectedContent?: boolean
      expectedErrors?: string[]
    }

    // execute system under test
    const cases: TestCase[] = [
      {
        variables: {
          contentMedium: "BASE64_STRING",
          content: newB64Content,
          metadataMedium: "UTF8_STRING",
          metadata: "mock-metadata-string",
          data: ' { "mockdata": 3 }',
        },
        expectedContent: true,
      },
      {
        variables: {
          contentMedium: "URI",
          content: 'fail-case-mock-content-URI',
          metadataMedium: "URI",
          metadata: "fail-case-mock-metadata-URI",
          data: ' { "mockdata": 7, "failCase": true }',
        },
        expectedErrors: ["__w3_abort: hash required for URI MediaType"],
      },
      {
        variables: {
          contentMedium: "URI",
          content: 'mock-content-URI',
          metadataMedium: "URI",
          metadata: "mock-metadata-URI",
          data: ' { "mockdata": 7 }',
          metadataHash: ethers.utils.keccak256(
            Buffer.from('mock-metadata-uri-hash')
          ),
          contentHash: ethers.utils.keccak256(
            Buffer.from('mock-content-uri-hash')
          ),
        },
        expectedContent: true
      },
      {
        variables: {
          contentMedium: "STRING",
          content: 'mock-content-URI',
          metadataMedium: "URI",
          metadata: "mock-metadata-URI",
          data: ' { "mockdata": 7 }',
        },
        expectedErrors: ["__w3_abort: Invalid key for enum 'MediaType': STRING"],
      },
    ]

    for (const i in cases) {
      const testCase = cases[i]
      if (testCase === undefined) {
        throw new Error("never")
      }
      const result = await client.query<{ registerPurchasableContent: TxResponse }>({
        uri: squadUri,
        query: `
          mutation registerPurchasableContent {
            registerPurchasableContent(
              creatorAddress: $creatorAddress
              licenseManagerAddress: $licenseManagerAddress
              contentMedium: $contentMedium
              content: $content
              metadataMedium: $metadataMedium
              metadata: $metadata
              registrant: $registrant
              sharePercentage: $sharePercentage
              price: $price
              ${testCase.variables?.data ? "data: $data" : ""}
              ${testCase.variables?.contentHash ? "contentHash: $contentHash" : ""}
              ${testCase.variables?.metadataHash ? "metadataHash: $metadataHash" : ""}
            )
          }`,
        variables: Object.assign(
          {
            creatorAddress,
            licenseManagerAddress: config.contracts.PurchasableLicenseManager.address,
            registrant,
            price: price.toString(),
            sharePercentage: sharePercentage.toString(),
          },
          testCase.variables
        )
      })
      if (result.errors === undefined) {
        expect(testCase.expectedErrors).toBeUndefined()
      } else {
        if(testCase.expectedErrors === undefined) {
          expect(result.errors).toBe("no errors")
          return // to narrow the type of testCase.expectedErrors
        }
        expect(testCase.expectedErrors.length).toBe(result.errors.length)
        result.errors.forEach(async (e, i) => {
          const expectedErrors = testCase.expectedErrors ?? []
          const expectedError = expectedErrors[i] ?? await unique()
          expect(e.message).toMatch(expectedError)
        })
      }

      if (testCase.expectedContent === true) {
        // find the log that includes the expected content
        const registerTxHash: string = result.data?.registerPurchasableContent.hash ?? ""
        const registerTx = await provider.getTransaction(registerTxHash)
        await registerTx.wait()
        const managerContract = new Contract(
          config.contracts.PurchasableLicenseManager.address,
          [`event ${NFTRegisteredAbi}`],
          provider,
        )
        const nftRegisteredFilter = managerContract.filters!.NFTRegistered!()
        const rawLogs = await provider.getLogs(nftRegisteredFilter)
        const rawLog = rawLogs[rawLogs.length - 1] ?? { topics: [""], data: "" }
        const log = managerContract.interface.parseLog(rawLog)
        expect(log.args).toHaveLength(7)
        const [
          loggedNftAddress,
          loggedNftId,
          loggedRegistrant,
          loggedPrice,
          loggedSharePercentage,
          loggedLicenseTokenAddress,
          loggedData,
        ] = log.args
        expect(loggedNftAddress).toBe(
          config.contracts.ERC721Squad.address
        )
        expect(loggedNftId.toNumber()).toBeLessThan(1000)
        expect(loggedNftId.toNumber()).toBeGreaterThan(-1)
        expect(loggedRegistrant).toBe(creator)
        expect(loggedPrice.toNumber()).toBe(price)
        expect(loggedSharePercentage).toBe(sharePercentage)
        expect(loggedLicenseTokenAddress).toBeDefined()
        expect(loggedData).toBe(testCase.variables.data)
      }
    }

    // That content should now be purchasable
    // test the purchase function here

    expect(purchaser).not.toBe(creator)
    let holdsLicenseResponse = await client.query<{holdsLicense: boolean}>({
      uri: squadUri,
      query: `
        query holdsLicense {
          holdsLicense(
            contractAddress: $contractAddress
            nftAddress: $nftAddress
            nftId: $nftId
            holder: $holder
          )
        }
      `,
      variables: {
        contractAddress: config.contracts.PurchasableLicenseManager.address,
        nftAddress: config.contracts.ERC721Squad.address,
        nftId: "1",
        holder: purchaser,
      }
    })
    expect(holdsLicenseResponse.errors).toBeUndefined()
    expect(holdsLicenseResponse.data?.holdsLicense).toBe(false)
    const approveResponse = await client.query<{approve: TxResponse}>({
      uri: squadUri,
      query: `
        mutation approve{
          approve(
            contractAddress: $contractAddress
            spender: $spender
            amount: $amount
            connection: {
              provider: "http://localhost:8545"
              signer: "${purchaser}"
            }
          )
        }
      `,
      variables: {
        contractAddress: config.contracts.ERC20Mintable.address,
        spender: config.contracts.PurchasableLicenseManager.address,
        amount: ethers.utils.parseEther("500").toString(),
      },
    })
    console.log("approve Errors", approveResponse.errors)
    const approveTx = await provider.getTransaction(approveResponse.data!.approve!.hash)
    await approveTx.wait()
    const purchaserBalance = await client.query({
      uri: squadUri,
      query: `
        query balanceOf {
balanceOf(
          address: $addr
          account: $acc
        )
}`,
      variables: {
        addr: config.contracts.ERC20Mintable.address,
        acc: purchaser
      }
    })
    const allowance = await client.query({
      uri: squadUri,
      query: `
        query allowance {
          allowance(
            connection: {
              provider: "http://localhost:8545"
              signer: "1"
            }
            address: $addr
            owner: $owner
            spender: $spender
          )
        }
      `,
      variables: {
        addr: config.contracts.ERC20Mintable.address,
        spender: config.contracts.PurchasableLicenseManager.address,
        owner: purchaser
      }
    })
    console.log(purchaserBalance, allowance)
    const purchaseResponse = await client.query<{purchase: TxResponse}>({
      uri: squadUri,
      query: `
        mutation purchase{
          purchase(
            contractAddress: $contractAddress
            nftAddress: $nftAddress
            nftId: $nftId
            purchaser: $purchaser
            numberToBuy: $numberToBuy
          )
        }
      `,
      variables: {
        contractAddress: config.contracts.PurchasableLicenseManager.address,
        nftAddress: config.contracts.ERC721Squad.address,
        nftId: "1",
        purchaser,
        numberToBuy: "1"
      },
    })
    expect(purchaseResponse.errors).toBeUndefined()
    holdsLicenseResponse = await client.query<{holdsLicense: boolean}>({
      uri: squadUri,
      query: `
        query holdsLicense {
          holdsLicense(
            nftAddress: $nftAddress
            nftId: $nftId
            holder: $holder
          )
        }
      `,
      variables: {
        nftAddress: config.contracts.ERC721Squad.address,
        nftId: "1",
        holder: purchaser,
      }
    })
    expect(holdsLicenseResponse.errors).toBeUndefined()
    expect(holdsLicenseResponse.data?.holdsLicense).toBe(true)
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
    const managerContract = new Contract(
      config.contracts.PurchasableLicenseManager.address,
      [`event ${NFTRegisteredAbi}`],
      provider,
    )

    const filters = managerContract.filters!.NFTRegistered!()
    // confirm the expected response
    const rawLogs = await provider.getLogs(
      managerContract.filters!.NFTRegistered!()
    )
    const rawRegisterLogs = await provider.getLogs(filters)
    const rawRegisterLog = rawLogs[rawLogs.length - 1] ?? { topics: [""], data: "" }
    const registerLog = managerContract.interface.parseLog(rawRegisterLog)
    expect(registerLog.name).toBe("NFTRegistered")
    const [
      loggedNftAddress,
      loggedNftId,
      loggedRegistrant,
      loggedPrice,
      loggedSharePercentage,
      loggedLicenseTokenAddress,
      loggedData,
    ] = registerLog.args ?? []

    expect(loggedNftAddress).toBe(nftAddress)
    expect(loggedNftId.toNumber()).toBe(nftId)
    expect(loggedRegistrant).toBe(registrant)
    expect(loggedPrice.toNumber()).toBe(price)
    expect(loggedSharePercentage).toBe(sharePercentage)
    expect(loggedData).toBe(data)
  })
})
