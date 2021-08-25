/**
 * Tests:
 *  - scaleAmountByPercentage returns expected value
 *  - incrementWindow updates current window, balanceForWindow, totalClaimableBalance, and merkleRoots,
 *    and emits WindowIncremented events propoerly, past the 2nd window
 *  - claim makes token transfers, emits Transfer events, updates totalClaimableBalance and isClaimed properly
 *  - claim fails for future windows
 *  - claim fails when called more than once for the same account and window
 *  - claim fails with an incorrect proof, but doesn't lock you out from a later valid claim
 */

import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import { ethers as ethersTypes } from 'ethers'
import { ERC20Mintable } from '../typechain/ERC20Mintable'
import { ERC20Mintable__factory } from '../typechain/factories/ERC20Mintable__factory'
import { Royalties } from '../typechain/Royalties'
import { Royalties__factory } from '../typechain/factories/Royalties__factory'
import { MerkleTree, Balance, createBalanceTree, getHexProof, verifyProof } from '@squad/lib/'

describe('Royalties', () => {
  /**
     * Before each should:
     *  - prepare the Royalties owner account
     *  - prepare at least 4 other accounts
     *  - deploy Royalties
     *  - deploy ERC20Mintable
     *  - mint some ERC20 to the royalties contract
     */

  let owner: ethersTypes.Signer
  let alice: ethersTypes.Signer
  let bob: ethersTypes.Signer
  let charlie: ethersTypes.Signer
  let dia: ethersTypes.Signer
  let erc20: ERC20Mintable
  let royalties: Royalties

  const PERCENTAGE_SCALE = 10e5

  async function getTree (): Promise<MerkleTree> {
    const signers = [owner, alice, bob, charlie, dia]
    const balances: Balance[] = []
    for (let i = 0; i <= 4; i++) {
      balances.push({
        account: await signers[i].getAddress(),
        allocation: ethers.BigNumber.from(20 * PERCENTAGE_SCALE)
      })
    }
    return createBalanceTree(balances)
  }

  async function windowAndProof (address: string, share: number): Promise<string[]> {
    const balanceTree: MerkleTree = await getTree()
    const hexRoot = balanceTree.getHexRoot()

    await royalties.incrementWindow(hexRoot)

    const proof = getHexProof(
      balanceTree,
      { account: address, allocation: ethers.BigNumber.from(share) }
    )

    return proof
  }

  beforeEach(async () => {
    const wallets = await ethers.getSigners()
    owner = wallets[0]
    alice = wallets[1]
    bob = wallets[2]
    charlie = wallets[3]
    dia = wallets[4]

    const ERC20MintableFactory = new ERC20Mintable__factory(owner)
    erc20 = await ERC20MintableFactory.deploy('Fake DAI', 'fDAI')

    const RoyaltiesFactory = new Royalties__factory(owner)
    royalties = await RoyaltiesFactory.deploy(erc20.address)

    await erc20.mint(royalties.address, ethers.utils.parseEther('10000'))
  })

  it('on scaleAmountByPercentage, returns expected value', async () => {
    const percent = 0.2
    const percentageScale = Number(await royalties.PERCENTAGE_SCALE())
    const result = Number(await royalties.scaleAmountByPercentage(10000, percentageScale * percent))
    assert.equal(percent / 100 * 10000, result)
  })

  it('on incrementWindow, updates state and emits event properly', async () => {
    // rev share tree
    const balanceTree: MerkleTree = await getTree()
    console.log('root', balanceTree.getHexRoot())
    const hexRoot = balanceTree.getHexRoot()

    // first window
    await expect(royalties.incrementWindow(hexRoot))
      .to.emit(royalties, 'WindowIncremented')
      .withArgs(
        ethers.BigNumber.from(1),
        ethers.utils.parseEther('10000'),
        ethers.utils.parseEther('10000'),
        hexRoot
      )

    // add funds
    await erc20.mint(royalties.address, ethers.utils.parseEther('20000'))

    // second window
    await expect(royalties.incrementWindow(hexRoot))
      .to.emit(royalties, 'WindowIncremented')
      .withArgs(
        ethers.BigNumber.from(2),
        ethers.utils.parseEther('20000'),
        ethers.utils.parseEther('30000'),
        hexRoot
      )
  })

  describe('claim', () => {
    it('transfers tokens, emits event, and updates state properly', async () => {
      const aliceAddress = await alice.getAddress()
      const share: number = 20 * PERCENTAGE_SCALE
      const proof = await windowAndProof(aliceAddress, share)
      const aliceAmount = 10000 * share / (100 * PERCENTAGE_SCALE)

      // to check at end
      const beforeClaimable = Number(
        ethers.utils.formatEther(await royalties.totalClaimableBalance())
      )
      const beforeAliceBalance = Number(
        ethers.utils.formatEther(await erc20.balanceOf(aliceAddress))
      )
      const isClaimedBefore = await royalties.isClaimed(0, aliceAddress)

      assert.isFalse(isClaimedBefore)

      const predictedAmount = beforeClaimable - aliceAmount

      // claim
      await expect(royalties.claim(
        0,
        aliceAddress,
        share,
        proof
      ))
        .to.emit(royalties, 'TransferToken')
        .withArgs(
          aliceAddress,
          ethers.utils.parseEther(String(aliceAmount)),
          ethers.utils.parseEther(predictedAmount.toString())
        )

      const afterClaimable = Number(
        ethers.utils.formatEther(await royalties.totalClaimableBalance())
      )
      const afterAliceBalance = Number(
        ethers.utils.formatEther(await erc20.balanceOf(aliceAddress))
      )
      const isClaimedAfter = await royalties.isClaimed(0, aliceAddress)

      assert.equal(predictedAmount, afterClaimable)
      assert.equal(beforeAliceBalance + aliceAmount, afterAliceBalance)
      assert.isTrue(isClaimedAfter)
    })

    it('fails when claiming for future windows', async () => {
      const aliceAddress = await alice.getAddress()
      const share: number = 20 * PERCENTAGE_SCALE
      const proof = await windowAndProof(aliceAddress, share)

      await expect(royalties.claim(
        1,
        aliceAddress,
        share,
        proof
      ))
        .to.be.revertedWith('Cannot claim for a future window')
    })

    it('fails when called more than once for the same account and window', async () => {
      const aliceAddress = await alice.getAddress()
      const share: number = 20 * PERCENTAGE_SCALE
      const proof = await windowAndProof(aliceAddress, share)

      await royalties.claim(
        0,
        aliceAddress,
        share,
        proof
      )

      await expect(royalties.claim(
        0,
        aliceAddress,
        share,
        proof
      ))
        .to.be.revertedWith('Account already claimed the given window')
    })

    it('fails with an incorrect proof, but does not lock out', async () => {
      const aliceAddress = await alice.getAddress()
      const share: number = 20 * PERCENTAGE_SCALE
      const proof = await windowAndProof(aliceAddress, share)
      const badProof = ['0xa' + proof[0].slice(3)]

      await expect(royalties.claim(
        0,
        aliceAddress,
        share,
        badProof
      ))
        .to.be.revertedWith('Invalid proof')

      await expect(royalties.claim(
        0,
        aliceAddress,
        share,
        proof
      ))
        .to.emit(royalties, 'TransferToken')
    })
  })
})
