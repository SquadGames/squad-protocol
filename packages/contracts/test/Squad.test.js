const { assert, expect } = require('chai')

const zeroAddress = "0x0000000000000000000000000000000000000000"

describe('Squad', () => {
    let owner, alice, bob, 
        squad, squadAlice, squadBob, 
        purchaseRights1, purchaseRights1Alice, purchaseRights1Bob,
        purchaseRights2, purchaseRights2Alice, purchaseRights2Bob,
        token1, token1Alice, token1Bob,
        token2, token2Alice, token2Bob,
        erc721
    const nftIdAlice = 1
    const nftIdBob = 2
    let nftCount = 2

    // before should:
        // establish 2+ user accounts (alice + bob)
        // deploy Squad w/ a non-0 fee, PurchaseRights x2, ERC20Mintable (reserve) x2, and an ERC721
        // mint 2 NFTs (1 for bob, 1 for alice)
        // mint some of both ERC20s for alice and bob
        // register one NFT without weights
        // addPayment to add one of the ERC20s to the system

    beforeEach(async () => {
        const wallets = await ethers.getSigners()
        owner = await wallets[0].getAddress()
        alice = await wallets[1].getAddress()
        bob = await wallets[2].getAddress()

        // deploy RightsManagers
        const PurchaseRights = await ethers.getContractFactory('PurchaseRights')
        purchaseRights1 = await PurchaseRights.deploy()
        purchaseRights1Alice = purchaseRights1.connect(wallets[1])
        purchaseRights1Bob = purchaseRights1.connect(wallets[2])

        purchaseRights2 = await PurchaseRights.deploy()
        purchaseRights2Alice = purchaseRights2.connect(wallets[1])
        purchaseRights2Bob = purchaseRights2.connect(wallets[2])
        
        // deploy Squad with one rights manager and non-0 fee
        const Squad = await ethers.getContractFactory('Squad')
        squad = await Squad.deploy([purchaseRights1.address], 100)
        squadAlice = squad.connect(wallets[1])
        squadBob = squad.connect(wallets[2])
        
        // deploy ERC20s
        const ERC20Mintable = await ethers.getContractFactory('ERC20Mintable')
        token1 = await ERC20Mintable.deploy('token1', 'TK1')
        token1Alice = token1.connect(wallets[1])
        token1Bob = token1.connect(wallets[2])
        token2 = await ERC20Mintable.deploy('token2', 'TK2')
        token2Alice = token2.connect(wallets[1])
        token2Bob = token2.connect(wallets[2])
        
        // deploy ERC721
        const ERC721 = await ethers.getContractFactory('ERC721Mintable')
        erc721 = await ERC721.deploy('NFT', 'NFT')

        // transfer RightsManagers ownership to Squad
        await purchaseRights1.transferOwnership(squad.address)
        await purchaseRights2.transferOwnership(squad.address)

        // mint tokens for Alice and Bob
        await token1.mint(alice, ethers.utils.parseEther('1000'))
        await token2.mint(alice, ethers.utils.parseEther('1000'))
        await token1.mint(bob, ethers.utils.parseEther('1000'))
        await token2.mint(bob, ethers.utils.parseEther('1000'))

        // mint NFTs owned by Alice and Bob
        await erc721.mint(alice, nftIdAlice)
        await erc721.mint(bob, nftIdBob)
        
        // register Alice's NFT in Squad with purchaseRights1
        await squadAlice.registerNFT(
            erc721.address, 
            nftIdAlice,
            500,
            [],
            [],
            [],
            purchaseRights1.address,
            token1.address,
            ethers.utils.parseEther('10')
        )

        // Bob buy rights to Alice's NFT from purchaseRights1
        const [, amount] = await purchaseRights1.price(erc721.address, nftIdAlice)
        await token1Bob.approve(purchaseRights1.address, amount)
        await purchaseRights1Bob.buy(erc721.address, nftIdAlice)
        await squad.withdraw(token1.address, alice)
    })

    // helpers
    async function fullWeights(addresses, ids, weights) {
        const resultsAddresses = []
        const resultsIds = []
        const resultsWeights = []
        for(let i = 0; i < addresses.length; i++) {
            const license = await squad.getLicense(addresses[i], ids[i])
            if (license.weights.length > 0) {
                resultsAddresses.push(addresses[i])
                resultsIds.push(ids[i])
                resultsWeights.push(weights[i] * license.ownerShare / 10000)
                license.weights.forEach((_, j) => {
                    if (license.weights[j] * weights[i] / 10000 * license.ownerShare / 10000 > 1*10^-18) {
                        resultsAddresses.push(license.weightsAddresses[j])
                        resultsIds.push(license.weightsIds[j])
                        resultsWeights.push(license.weights[j] * weights[i] / 10000 * license.ownerShare / 10000)
                    }
                })
            } else {
                resultsAddresses.push(addresses[i])
                resultsIds.push(ids[i])
                resultsWeights.push(weights[i])
            }
        }
        return [resultsAddresses, resultsIds, resultsWeights]
    }

    it('cannot be constructed with a fee higher than 10000', async () => {
        const Squad = await ethers.getContractFactory('Squad')
        try {
            await Squad.deploy([purchaseRights1.address], 10001)
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })

    it('does not let someone besides the NFT owner register an NFT', async () => {
        try {
            await squadAlice.registerNFT(
                erc721.address, 
                nftIdBob,
                500,
                [],
                [],
                [],
                purchaseRights1.address,
                token1.address,
                ethers.utils.parseEther('10')
            )
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })

    it('does not let an owner register an NFT with an ownerShare greater than 10,000', async () => {
        try {
            await squadAlice.registerNFT(
                erc721.address,
                nftIdBob,
                10001,
                [],
                [],
                [],
                purchaseRights1.address,
                token1.address,
                ethers.utils.parseEther('1')
            )
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })

    it('does not let an owner register an NFT with weights that sum to > 10,000', async () => {
        try {
            await squadAlice.registerNFT(
                erc721.address,
                nftIdBob,
                1000,
                [erc721.address, erc721.address],
                [nftIdAlice, nftIdAlice],
                [5000, 5001],
                purchaseRights1.address,
                token1.address,
                ethers.utils.parseEther('1')
            )
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })

    it('lets an owner register an NFT with weights, which someone else can buy rights to, distributing payments properly', async () => {
        const weightsAddresses = []
        const weightsIds = []
        const weights = []
        const length = 20
        for (let i = 0; i < length; i++) {
            weightsAddresses.push(erc721.address)
            weightsIds.push(nftIdAlice)
            weights.push(10000 / length)
        }
        nftCount++
        await erc721.mint(bob, nftCount)
        await squadBob.registerNFT(
            erc721.address, 
            nftCount,
            5000,
            weightsAddresses,
            weightsIds,
            weights,
            purchaseRights1.address,
            token1.address,
            ethers.utils.parseEther('10')
        )
        let license = await squad.getLicense(erc721.address, nftCount)
        assert.equal(length, license.weightsAddresses.length)
        assert.equal(length, license.weightsIds.length)
        assert.equal(length, license.weights.length)
        
        await token1Alice.approve(purchaseRights1.address, ethers.utils.parseEther('10'))
        await purchaseRights1Alice.buy(erc721.address, nftCount)
        assert.isTrue(await purchaseRights1.check(erc721.address, nftCount, alice))

        assert.equal(ethers.utils.formatEther(await squad.balance(token1.address, bob)), '5.0')
        assert.equal(ethers.utils.formatEther(await squad.balance(token1.address, alice)), '5.0')
    })

    it('returns correct rights params', async () => {
        const params = await squad.rightsParamsFor(erc721.address, nftIdAlice)
        assert.equal(params[0], token1.address)
        assert.equal(ethers.utils.formatEther(params[1]), '10.0')
    })

    it('pays the owner of squad the correct fee', async () => {
        assert.equal(ethers.utils.formatEther(await token1.balanceOf(owner)), '0.1')
    })

    it('does not let you add the 0 address as a rights manager', async () => {
        try {
            await squad.addRightsManager(zeroAddress)
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })

    it('allows a valid address to be added as a rights manager', async () => {
        await squad.addRightsManager(purchaseRights2.address)
        const managers = await squad.getRightsManagers()
        assert.equal(managers[1], purchaseRights2.address)
    })

    it('leaves a empty array index after removing a rightsManager, which is filled when adding a new one', async () => {
        let managers = await squad.getRightsManagers()
        assert.notEqual(managers[0], zeroAddress)

        await squad.addRightsManager(purchaseRights2.address)
        await squad.removeRightsManager(0)
        managers = await squad.getRightsManagers()
        assert.equal(managers[0], zeroAddress)

        await squad.addRightsManager(purchaseRights1.address)
        managers = await squad.getRightsManagers()
        assert.notEqual(managers[0], zeroAddress)
    })

    it('lets the owner update the fee properly', async () => {
        const newFee = 1000
        await squad.setFee(newFee)
        const fee = Number(await squad.getFee())
        assert.equal(newFee, fee)
    })

    it('does not let non-owners set the fee', async () => {
        try {
            await squadAlice.setFee(1000)
        } catch (e) {
            assert.equal(e.name, 'ProviderError')
        }
    })
})