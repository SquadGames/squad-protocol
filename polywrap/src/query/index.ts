import {
  Ethereum_Query,
  Input_balanceOf,
  Input_allowance,
  Ipfs_Query,
  Input_getLastNftData,
  GraphNode_Query,
  Input_queryGraphNode,
  Input_holdsLicense,
} from "./w3";

import { BigInt } from "@web3api/wasm-as"

export function holdsLicense(input: Input_holdsLicense): bool {
  const res = Ethereum_Query.callContractView({
    address: input.contractAddress,
    method: "function holdsLicense(address,uint256,address) view returns(bool)",
    args: [input.nftAddress, input.nftId.toString(), input.holder],
    connection: input.connection,
  })
  return res == "true"
}

const SUBGRAPH_API_URL =
  'http://127.0.0.1:8000/subgraphs/name/squadgames/squad-POC-subgraph'

export function queryGraphNode(input: Input_queryGraphNode): String {
  const res = GraphNode_Query.querySubgraph({
    subgraphAuthor: "squadgames",
    subgraphName: "squad-POC-subgraph",
    query: input.query
  })
  return res
}

export function balanceOf(input: Input_balanceOf): BigInt {
  const res = Ethereum_Query.callContractView({
    address: input.address,
    method: "function balanceOf(address account) view returns(uint256)",
    args: [input.account],
    connection: input.connection
  })
  return BigInt.fromString(res)
}

export function allowance(input: Input_allowance): BigInt {
  const res = Ethereum_Query.callContractView({
    address: input.address,
    method: "function allowance(address owner,address spender) view returns(uint256)",
    args: [input.owner, input.spender],
    connection: input.connection
  })
  return BigInt.fromString(res)
}

// for testing only, most likely
export function getLastNftData(input: Input_getLastNftData): string {
  const nextIdString = Ethereum_Query.callContractView({
    address: input.address,
    method: "function nextTokenId() view returns(uint256)",
    args: [],
    connection: input.connection
  })

  const id = BigInt.fromString(nextIdString).subInt(1).toString()

  const hash = Ethereum_Query.callContractView({
    address: input.address,
    method: "function contentURIs(uint256) view returns(string)",
    args: [id],
    connection: input.connection
  })

  return String.UTF8.decode(
    Ipfs_Query.catFile({ cid: hash })
  )
}
