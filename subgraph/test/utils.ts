import { ethers } from 'ethers'
import axios from 'axios'
import BalanceTree from '../../hardhat/lib/balance-tree'
import { getConfig, getSecrets } from '@squad/lib'
import * as fs from 'fs'

const config = getConfig()
const secrets = getSecrets()
const contracts = config.contracts

function parseJsonFile (path: string): any {
  return JSON.parse(
    fs.readFileSync(path).toString()
  )
}

const PurchasableLicenseManagerAbi =
  parseJsonFile(contracts.PurchasableLicenseManager.abiPath).abi
const RevShareLicenseManagerAbi =
  parseJsonFile(contracts.RevShareLicenseManager.abiPath).abi
const SquadNFTAbi = parseJsonFile(contracts.ERC721Squad.abiPath).abi
const ERC20Abi = parseJsonFile(contracts.ERC20Mintable.abiPath).abi
const RoyaltiesAbi = parseJsonFile(contracts.Royalties.abiPath).abi

const APIURL =
  'http://127.0.0.1:8000/subgraphs/name/squadgames/squad-POC-subgraph'

const SQUAD_NFT_ADDR = contracts.ERC721Squad.address.toLowerCase()
const FDAI_ADDR = contracts.ERC20Mintable.address.toLowerCase()
const ROYALTIES_ADDR = contracts.Royalties.address.toLowerCase()
const PERCENTAGE_SCALE = 10e5
const ALICE_ALLOC = ethers.BigNumber.from(50 * PERCENTAGE_SCALE)

export const PURCHASABLE_LM_ADDR =
  contracts.PurchasableLicenseManager.address.toLowerCase()
export const REV_SHARE_LM_ADDR =
  contracts.RevShareLicenseManager.address.toLowerCase()
export const DEF_PRICE = ethers.utils.parseEther('10')
export const DEF_SHARE = 50
export const DEF_TYPE = 'jpeg'
export const GRAPH_DELAY = 1500

const provider = ethers.getDefaultProvider(config.networkNameOrUrl)

const squadNft = new ethers.Contract(
  SQUAD_NFT_ADDR,
  SquadNFTAbi,
  provider
)

const royalties = new ethers.Contract(
  ROYALTIES_ADDR,
  RoyaltiesAbi,
  provider
)

const purchasableLicenseManager = new ethers.Contract(
  PURCHASABLE_LM_ADDR,
  PurchasableLicenseManagerAbi,
  provider
)

const revShareLicenseManager = new ethers.Contract(
  REV_SHARE_LM_ADDR,
  RevShareLicenseManagerAbi,
  provider
)

const fDai = new ethers.Contract(
  FDAI_ADDR,
  ERC20Abi,
  provider
)

// TODO revert subgraph test utils signer and contract connections to sync
export const signer = new ethers.Wallet(secrets.deployPrivateKey, provider)

const aliceRoyalties = royalties.connect(signer)
const alicePlm = purchasableLicenseManager.connect(signer)
const aliceRslm = revShareLicenseManager.connect(signer)
const aliceNft = squadNft.connect(signer)
const aliceFDai = fDai.connect(signer)

interface TokenData {
  contentURI: string
  metadataURI: string
  contentHash: ethers.BytesLike
  metadataHash: ethers.BytesLike
}

export const defTokenData: TokenData = {
  contentURI: 'example1.com',
  metadataURI: 'example2.com',
  contentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('content')),
  metadataHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('metadata'))
}

export interface NFT {
  address: string
  id: ethers.BigNumber
  blockCreated: number
  creator: string
  contentURI: string
  metadataURI: string
  metadataHash: ethers.BytesLike
}

export async function delay (ms: number = GRAPH_DELAY): Promise<void> {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

export async function mint (): Promise<NFT> {
  const id = await aliceNft.nextTokenId()
  const tx = await aliceNft.mint(
    signer.address,
    defTokenData.contentURI,
    defTokenData.metadataURI,
    defTokenData.contentHash,
    defTokenData.metadataHash
  )
  const res = await tx.wait()
  const nft: NFT = {
    address: squadNft.address.toLowerCase(),
    id: id,
    blockCreated: res.blockNumber,
    contentURI: defTokenData.contentURI,
    metadataURI: defTokenData.metadataURI,
    metadataHash: defTokenData.metadataHash,
    creator: signer.address
  }
  return nft
}

export async function registerPL (
  nft: NFT,
  price: ethers.BigNumber,
  share: number,
  type: string
): Promise<void> {
  const jsonString = JSON.stringify({ type })
  await alicePlm.registerNFT(
    nft.address,
    nft.id,
    signer.address,
    price,
    share,
    jsonString
  )
}

export async function unregisterPL (nft: NFT): Promise<void> {
  await alicePlm.unregisterNFT(nft.address, nft.id)
  await delay()
}

export async function mintAndRegisterPL (): Promise<NFT> {
  const nft = await mint()
  await registerPL(nft, DEF_PRICE, DEF_SHARE, DEF_TYPE)
  await delay()
  return nft
}

export async function registerRSL (nft: NFT, share: number, type: string): Promise<void> {
  const jsonString = JSON.stringify({ type })
  await aliceRslm.registerNFT(
    nft.address,
    nft.id,
    signer.address,
    share,
    jsonString
  )
}

export async function unregisterRSL (nft: NFT): Promise<void> {
  await aliceRslm.unregisterNFT(nft.address, nft.id)
  await delay()
}

export async function mintAndRegisterRSL (): Promise<NFT> {
  const nft = await mint()
  await registerRSL(nft, DEF_SHARE, DEF_TYPE)
  await delay()
  return nft
}

export async function getPurchasableLicense (nft: NFT): Promise<any> {
  return purchasableLicenseManager.registeredNFTs(nft.address, nft.id)
}

export async function getRevShareLicense (nft: NFT): Promise<any> {
  return revShareLicenseManager.registeredNFTs(nft.address, nft.id)
}

export async function mintDaiAndPurchase (nft: NFT, price: ethers.BigNumber): Promise<number> {
  await aliceFDai.mint(signer.address, price)
  await aliceFDai.approve(purchasableLicenseManager.address, price)
  const tx = await alicePlm.purchase(nft.address, nft.id, signer.address, 1)
  const res = await tx.wait()
  await delay()
  return res.blockNumber
}

export async function mintAndIncrement (): Promise<number> {
  const proofInfo = await getProofInfo()
  await aliceFDai.mint(ROYALTIES_ADDR, DEF_PRICE)
  const tx = await aliceRoyalties.incrementWindow(proofInfo.ROOT)
  const res = await tx.wait()
  await delay()
  return res.blockNumber
}

export async function getBalanceForWindow (index: number): Promise<number> {
  const windowFunds = await royalties.balanceForWindow(index)
  return Number(windowFunds)
}

export async function getTotalClaimableBalance (): Promise<ethers.BigNumber> {
  return royalties.totalClaimableBalance()
}

export async function getCurrentWindow (): Promise<number> {
  return Number(await royalties.currentWindow())
}

interface ClaimRes {
  tx: ethers.Transaction
  res: any
}

export async function getProofInfo (): Promise<{ROOT: string, PROOF: string[]}> {
  const balances = [
    {
      account: signer.address,
      allocation: ALICE_ALLOC
    },
    {
      account: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      allocation: ALICE_ALLOC
    }
  ]
  const balanceTree: BalanceTree = new BalanceTree(balances)
  const ROOT = balanceTree.getHexRoot()
  const PROOF = balanceTree.getHexProof(signer.address, ALICE_ALLOC)
  return { ROOT, PROOF }
}

export async function claim (windowIndex: number): Promise<ClaimRes> {
  const proofInfo = await getProofInfo()
  const tx = await aliceRoyalties.claim(
    windowIndex,
    signer.address,
    Number(ALICE_ALLOC),
    proofInfo.PROOF
  )
  const res = await tx.wait()
  await delay()
  return { tx, res }
}

// GRAPH QUERIES

export function makeContentId (nft: NFT): string {
  let id = nft.id.toHexString()
  // BigNumber.toHexString always has at least two characters (01), but we want
  // one character when id is less than 10
  if (id[2] === '0') { id = id.slice(0, 2) + id.slice(3) }
  return `${nft.address}-${id}`.toLowerCase()
}

export function makeLicenseId (nft: NFT, licenseManagerAddress: string): string {
  return `${makeContentId(nft)}-${licenseManagerAddress.toLowerCase()}`
}

export async function querySquadNFT (nft: NFT): Promise<NFT> {
  const query = `{
    squadNFT(id: "${Number(nft.id)}") {
      id
      creator
      contentURI
      metadataURI
      metadataHash
      blockCreated
    }
  }`
  return (await querySubgraph(query)).data.squadNFT
}

export async function queryContent (nft: NFT): Promise<any> {
  const contentId = makeContentId(nft)
  const query = `{
    content(id: "${contentId}") {
      id
      nftAddress
      nftId
      type
      purchasableLicenses {
        id
      }
      revShareLicenses {
        id
      }
    }
  }`
  return (await querySubgraph(query)).data.content
}

export async function queryPurchasableLicenses (nft: NFT, licenseManagerAddress: string): Promise<any> {
  const contentId = makeContentId(nft)
  const query = `{
    content(id: "${contentId}") {
      purchasableLicenses(licenseManagerAddress: "${licenseManagerAddress}") {
        id
        licenseManagerAddress
        registrant
        price
        sharePercentage
        licenseTokenAddress
      }
    }
  }`
  return (await querySubgraph(query)).data.content.purchasableLicenses
}

export async function queryRevShareLicenses (nft: NFT, licenseManagerAddress: string): Promise<any> {
  const contentId = makeContentId(nft)
  const query = `{
    content(id: "${contentId}") {
      revShareLicenses(licenseManagerAddress: "${licenseManagerAddress}") {
        id
        licenseManagerAddress
        registrant
        minSharePercentage
      }
    }
  }`
  return (await querySubgraph(query)).data.content.revShareLicenses
}

export async function queryAllContent (): Promise<any> {
  const query = `{
    contents {
      id
      nftAddress
      nftId
      type
      purchasableLicenses {
        id
      }
      revShareLicenses {
        id
      }
    }
  }`
  return (await querySubgraph(query)).data.contents
}

export async function queryPurchases (nft: NFT, licenseManagerAddress: string): Promise<any> {
  const licenseId = makeLicenseId(nft, licenseManagerAddress)
  const query = `{
    purchasableLicense(id: "${licenseId}") {
      purchases {
        id
        purchaser
        licensesBought
        pricePaid
        licenseTokenAddress
        blockNumber
      }
    }
  }`
  return (await querySubgraph(query)).data.purchasableLicense.purchases
}

export async function queryWindow (id: string): Promise<any> {
  const query = `{
    window(id: "${id}") {
      index
      fundsAvailable
      merkleRoot
      blockNumber
    }
  }`
  return (await querySubgraph(query)).data.window
}

export async function queryTransfer (hash: string | undefined): Promise<any> {
  if (hash === undefined) {
    throw new Error('Hash required to query transfers but was undefined')
  }
  const query = `{
    transfer(id: "${hash}") {
      id
      to
      amount
      totalClaimableBalance
      blockNumber
    }
  }`
  return (await querySubgraph(query)).data.transfer
}

async function querySubgraph (query: string): Promise<any> {
  let res
  try {
    res = (await axios.post(APIURL, { query })).data
  } catch (err) {
    console.error('Graph query error: ', err)
  }
  return res
}
