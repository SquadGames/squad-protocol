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
} from "./w3"

import { BigInt } from "@web3api/wasm-as"

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

export function registerPurchasableContent(
  input: Input_registerPurchasableContent
): String {
  throw new Error("Not Implemented")
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
