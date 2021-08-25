import { Balance, createBalanceTree, getHexProof, verifyProof, MerkleTree } from "../src/index"
import { BigNumber } from "ethers"

const balances: Balance[] = [
  {
    account: "0x123456",
    allocation: BigNumber.from("1")
  },
  {
    account: "0x123456",
    allocation: BigNumber.from("2")
  },
  {
    account: "0x12345678",
    allocation: BigNumber.from("3")
  }
]

// This is not working right now!! Why is the root empty??

const tree = createBalanceTree(balances)
console.log(tree.getLayers())
console.log(tree.getHexRoot())
console.log(getHexProof(tree, balances[0] as Balance))
console.log(verifyProof(
  tree, 
  balances[0] as Balance,
  tree.getHexRoot(),
  getHexProof(tree, balances[0] as Balance)
))

const a: string[] = ['a', 'b', 'c']
const tree2 = new MerkleTree(a)
console.log(tree2.getLayers())
console.log(tree2.getHexRoot())