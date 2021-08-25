import MerkleTree from 'merkletreejs'
import { BigNumber, utils } from 'ethers'

export { MerkleTree }

export interface Balance { account: string; allocation: BigNumber; }

export function createBalanceTree(balances: Balance[]): MerkleTree {
  return new MerkleTree(
    balances.map(b => { return toLeaf(b)}),
    utils.keccak256,
    { sortPairs: true }
  )
}

export function getProof(balanceTree: MerkleTree, balance: Balance): Buffer[] {
  return balanceTree.getProof(
    toLeaf(balance)
  )
}

export function getHexProof(balanceTree: MerkleTree, balance: Balance): string[] {
  return balanceTree.getHexProof(
    toLeaf(balance)
  )
}

export function verifyProof(
  balanceTree: MerkleTree,
  balance: Balance,
  root: string | Buffer,
  proof: string[] | Buffer[]
): boolean {
  return balanceTree.verify(
    proof,
    toLeaf(balance),
    root
  )
}

function toLeaf (balance: Balance): string {
  return utils.solidityKeccak256(
    ['address', 'uint256'], 
    [balance.account, balance.allocation]
  )
}