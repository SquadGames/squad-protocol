import { ethers } from 'ethers'

export interface Balance {
  account: string
  allocation: ethers.BigNumber
}

export function toHexLeaf (balance: Balance): string {
  return ethers.utils
    .solidityKeccak256(['address', 'uint256'], [balance.account, balance.allocation])
    .substr(2)
}

export function toLeaf (balance: Balance): Buffer {
  return Buffer.from(
    toHexLeaf(balance),
    'hex'
  )
}
