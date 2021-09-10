import {
  Ethereum_Mutation,
  Ethereum_TxResponse,
  Ethereum_Connection,
  Ipfs_Mutation,
  Input_mintNFT,
  Input_registerPurchasableNFTContent,
  Input_registerRevShareNFTContent,
  Input_registerPurchasableContent,
  Input_registerRevShareContent,
  Input_approve,
  Sha3_Query,
} from "./w3"

import { BigInt } from "@web3api/wasm-as"
import * as b64 from 'as-base64'

class ContentInfo {
  uri: string
  sha3: string
}

export function mintNFT(input: Input_mintNFT): Ethereum_TxResponse {
  // TODO use register content implementations for mintNFT for hashing and IPFS
  const contentURI = Ipfs_Mutation.addFile({
    data: String.UTF8.encode(input.content)
  })
  const metadataURI = Ipfs_Mutation.addFile({
    data: String.UTF8.encode(input.metadata)
  })
  const contentHash: string = "0x0000000000000000000000000000000000000000000000000000006d6168616d"
  const metadataHash: string = "0x0000000000000000000000000000000000000000000000000000006d6168616d"

  const res: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    connection: input.connection,
    address: input.contractAddress,
    method: "function mint(address,string,string,bytes32,bytes32) external returns(uint256)",
    args: [input.creatorAddress, contentURI, metadataURI, contentHash, metadataHash],
    txOverrides: null
  })

  return res
}

export function registerPurchasableNFTContent(
  input: Input_registerPurchasableNFTContent
): Ethereum_TxResponse {
  const data: String = input.data === null ? "" : input.data!
  const res: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    address: input.licenseManagerAddress,
    method: "function registerNFT(address,uint256,address,uint256,uint8,string)",
    args: [
      input.nftAddress,
      input.nftId.toString(),
      input.registrant,
      input.price.toString(),
      input.sharePercentage.toString(),
      data,
    ],
    connection: input.connection,
    txOverrides: null,
  })
 return res
}


function handleBase64StringContent(content: string, hash: string | null): ContentInfo {
  const data = b64.decode(content).buffer
  const uri = Ipfs_Mutation.addFile({ data })
  const sha3 = Sha3_Query.buffer_keccak_256({ message: data })
  if (sha3 !== hash && hash !== null) {
    throw new Error("hash missmatch, are you using sha3?")
  }
  return { uri, sha3 }
}

function handleUTF8StringContent(content: string, hash: string | null): ContentInfo {
  const data = String.UTF8.encode(content)
  const uri = Ipfs_Mutation.addFile({ data })
  const sha3 = Sha3_Query.buffer_keccak_256({ message: data })
  if (sha3 !== hash && hash !== null) {
    throw new Error("hash missmatch, are you using sha3?")
  }
  return { uri, sha3 }
}


function handleURIContent(content: string, hash: string | null): ContentInfo {
  if (hash === null) {
    throw new Error("hash required for URI MediaType")
  }
  return { uri: content, sha3: hash }
}

/*
type ContentHandler = (content: string, hash?: string) => ContentInfo
*/
// TODO can we modularize and release this NFT creation stuff and release is separately?
function handler(medium: MediaType): (content: string, hash: string | null) => ContentInfo {
  switch (medium) {
    case MediaType.UTF8_STRING:
      return handleUTF8StringContent
      break
    case MediaType.BASE64_STRING:
      return handleBase64StringContent
      break
    case MediaType.URI:
      return handleURIContent
      break
    default:
      throw new Error(`Unknown medium ${medium}, unreachable code`)
  }
}

enum MediaType {
  UTF8_STRING,
  BASE64_STRING,
  URI,
}

export function registerContent(
  licenseManagerAddress: string,
  methodAbi: string,
  tailArgs: string[],
  creatorAddress: string,
  content: string,
  contentMedium: MediaType,
  contentHash: string | null,
  metadata: string,
  metadataMedium: MediaType,
  metadataHash: string | null,
  connection: Ethereum_Connection | null,
  data: string | null,
): Ethereum_TxResponse {

  // put the content and metadata on IPFS and get their URIs
  const contentInfo = handler(contentMedium)(content, contentHash)
  const metadataInfo = handler(metadataMedium)(metadata, metadataHash)

  // Handle cases where the hash does and does not have the 0x prefix
  const contentHash = contentInfo.sha3.length === 64
    ? `0x${contentInfo.sha3}`
    : contentInfo.sha3
  const metadataHash = metadataInfo.sha3.length === 64
    ? `0x${contentInfo.sha3}`
    : metadataInfo.sha3

  data = data === null ? "" : data
  const res: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    address: licenseManagerAddress,
    method: methodAbi,
    args: [
      creatorAddress,
      contentInfo.uri,
      metadataInfo.uri,
      contentHash,
      metadataHash,
    ].concat(tailArgs).concat([data]),
    connection: connection,
    txOverrides: null,
  })

  return res
}

export function registerPurchasableContent(
  input: Input_registerPurchasableContent
): Ethereum_TxResponse {
  const createAndRegisterNFTAbi = "function createAndRegisterNFT(address,string,string,bytes32,bytes32,uint256,uint8,string)"
  return registerContent(
    input.licenseManagerAddress,
    createAndRegisterNFTAbi,
    [input.price.toString(), input.sharePercentage.toString()],
    input.creatorAddress,
    input.content,
    input.contentMedium,
    input.contentHash,
    input.metadata,
    input.metadataMedium,
    input.metadataHash,
    input.connection,
    input.data
  )
}

export function registerRevShareNFTContent(
  input: Input_registerRevShareNFTContent
): Ethereum_TxResponse {
  const data: String = input.data === null ? "" : input.data!
  const res: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    address: input.licenseManagerAddress,
    method: "function registerNFT(address,uint256,address,uint8,string)",
    args: [
      input.nftAddress,
      input.nftId.toString(),
      input.registrant,
      input.minSharePercentage.toString(),
      data,
    ],
    connection: input.connection,
    txOverrides: null,
  })

  return res
}

export function registerRevShareContent(
  input: Input_registerRevShareContent
): Ethereum_TxResponse {
  const createAndRegisterNFTAbi = "function createAndRegisterNFT(address,string,string,bytes32,bytes32,uint8,string)"
  return registerContent(
    input.licenseManagerAddress,
    createAndRegisterNFTAbi,
    [input.minSharePercentage.toString()],
    input.creatorAddress,
    input.content,
    input.contentMedium,
    input.contentHash,
    input.metadata,
    input.metadataMedium,
    input.metadataHash,
    input.connection,
    input.data,
  )
}

export function approve(input: Input_approve): Ethereum_TxResponse {
  const txResponse: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    address: input.address,
    method: "function approve(address spender,uint256 amount) returns(bool)",
    args: [input.spender, input.amount.toString()],
    connection: input.connection,
    txOverrides: null
  });
  return txResponse;
}
