import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import BalanceTree from "../scripts/lib/balance-tree"

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

describe('Royalties', () => {
    /**
     * Before each should:
     *  - prepare the Royalties owner account
     *  - prepare at least 4 other accounts
     *  - deploy Royalties
     *  - deploy ERC20Mintable
     *  - mint some ERC20 to the royalties contract
     */

    let owner, alice, bob, charlie, dia
    let erc20
    let royalties

    const PERCENTAGE_SCALE = 10e5

    async function getTree(): Promise<BalanceTree> {
        const wallets = [owner, alice, bob, charlie, dia]
        const balances = []
        for (let i = 0; i <= 4; i++) {
            balances.push({
                account: await wallets[i].getAddress(),
                allocation: ethers.BigNumber.from(20 * PERCENTAGE_SCALE)
            })
        }
        return new BalanceTree(balances)
    }

    async function windowAndProof(address: string, share: number) {
        const balanceTree: BalanceTree = await getTree()
        const hexRoot = balanceTree.getHexRoot()
    
        await royalties.incrementWindow(hexRoot)
    
        const proof = balanceTree.getHexProof(
            address, 
            ethers.BigNumber.from(share)
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

        const ERC20Mintable = await ethers.getContractFactory('ERC20Mintable')
        erc20 = await ERC20Mintable.deploy('Fake DAI', 'fDAI')

        const Royalties = await ethers.getContractFactory('Royalties')
        royalties = await Royalties.deploy(erc20.address)

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
        const balanceTree: BalanceTree = await getTree()
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

    it('on claim, transfers tokens, emits event, and updates state properly', async () => {
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
                erc20.address
            )
        
        const afterClaimable = Number(
            ethers.utils.formatEther(await royalties.totalClaimableBalance())
        )
        const afterAliceBalance = Number(
            ethers.utils.formatEther(await erc20.balanceOf(aliceAddress))
        )
        const isClaimedAfter = await royalties.isClaimed(0, aliceAddress)

        assert.equal(beforeClaimable - aliceAmount, afterClaimable)
        assert.equal(beforeAliceBalance + aliceAmount, afterAliceBalance)
        assert.isTrue(isClaimedAfter)
    })

    it('on claim, fails when claiming for future windows', async () => {
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

    it('on claim, fails when called more than once for the same account and window', async () => {
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

    it('on claim, fails with an incorrect proof, but does not lock out', async () => {
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