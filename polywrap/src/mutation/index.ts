import {
  Ethereum_Mutation,
  Ethereum_TxResponse,
  Ipfs_Mutation,
  Input_mintNFT,
  Input_registerPurchasableNFTContent,
  Input_registerRevShareNFTContent,
  Input_registerPurchasableContent,
  Input_registerRevShareContent,
  Input_approve,
//  Sha3_Query,
} from "./w3"

import { BigInt } from "@web3api/wasm-as"
import * as b64 from 'as-base64'


export function mintNFT(input: Input_mintNFT): Ethereum_TxResponse {
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

const createAndRegisterNFTAbi = "function createAndRegisterNFT(address,string,string,bytes32,bytes32,uint256,uint8,string"

interface ContentInfo {
  uri: string
  sha3: string
}

function handleBase64StringContent(content: string, hash?: string): ContentInfo {
  const data = b64.decode(content)
  const uri = IPFS_Mutation.add(data)
  const sha3 = Sha3_Query.keccak_256(data)
  if (sha3 !== hash) {
    throw new Error("hash missmatch, are you using sha3?")
  }
  return { uri, sha3 }
}

function handleStringContent(content: string, hash?: string): ContentInfo {
  const uri = IPFS_Mutation.add(content)
  const sha3 = Sha3_Query.keccak_256(content)
  if (sha3 !== hash) {
    throw new Error("hash missmatch, are you using sha3?")
  }
  return { uri, sha3 }
}

function handleURIContent(content: string, hash?: string): ContentInfo {
  if (hash === "") {
    throw new Error("hash required for URI MediaType")
  }
  return { uri: content, sha3: hash }
}

type ContentHandler = (content: string, hash?: string) => ContentInfo

enum MediaType {
  String = "STRING",
  Base64String = "BASE64_STRING",
  URI = 'URI',
}

function handler(medium: MediaType): ContentHandler {
  switch (medium) {
    case MediaType.STRING:
      return { fn: handleStringContent }
      break
    case MediaType.BASE64_STRING:
      return { fn: handleBase64StringContent }
      break
    case MediaType.URI:
      return { fn: handleURIContent }
      break
    default:
      return never
  }
}

export function registerPurchasableContent(
  input: Input_registerPurchasableContent
): Ethereum_TxResponse {

  // put the content and metadata on IPFS and get their URIs
  const contentInfo = handler(input.contentMedium)(input.content)
  const metadataInfo = handler(input.metadataMedium)(input.metadata)

  const data: String = input.data === null ? "" : input.data!
  const res: Ethereum_TxResponse = Ethereum_Mutation.callContractMethod({
    address: input.licenseManagerAddress,
    method: createAndRegisterNFTAbi,
    args: [
      input.creatorAddress,
      contentInfo.uri,
      metadataInfo.uri,
      contentInfo.hash,
      metadataInfo.hash,
      input.price,
      input.sharePercentage,
      data,
    ],
    connection: input.connection,
    txOverrides: null,
  })

  return res
}

export function registerRevShareNFTContent(
  input: Input_registerRevShareNFTContent
): String {
  throw new Error("Not Implemented")
}

export function registerRevShareContent(
  input: Input_registerRevShareContent
): String {
  throw new Error("Not Implemented")
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
