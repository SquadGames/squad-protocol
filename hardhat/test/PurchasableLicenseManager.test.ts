/**
 * Tests:
 *  - on registerNFT, stores new valid LicenseParams and emits event
 *  - on registerNFT, fails if sharePercentage is greater than 100
 *  - on registerNFT, fails if registrant does not own the NFT
 *  - __on registerNFT, fails if NFT does not exist (nevermind, the NFT contract already covers this)
 *  - on registerNFT, replaces an old license for the same NFT
 *  - on createAndRegisterNFT, mints a new NFT to the msg.sender and calls registerNFT
 *  - on unregisterNFT, deletes LicenseParams and emits event
 *  - on unregisterNFT, fails if the NFT is not registered
 *  - on purchase, transfers tokens, mints license(s), and emits event
 *  - on holdsLicense, returns true if holder has 1+ ether of license token
 *  - on holdsLicense, returns false if holder has <1 ether of license token
 */

import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import { ethers as ethersTypes } from 'ethers'
import { ERC20Mintable } from '../typechain/ERC20Mintable'
import { ERC20Mintable__factory } from '../typechain/factories/ERC20Mintable__factory'
import { PurchasableLicenseManager } from '../typechain/PurchasableLicenseManager'
import { PurchasableLicenseManager__factory } from '../typechain/factories/PurchasableLicenseManager__factory'
import { ERC721Squad } from '../typechain/ERC721Squad'
import { ERC721Squad__factory } from '../typechain/factories/ERC721Squad__factory'

describe('PurchasableLicenseManager', () => {
  /**
     * Before each should:
     *  - prepare accounts, (alice, royalties address)
     *  - deploy erc20mintable, purchasable license and mock media
     */

  let owner: ethersTypes.Signer
  let alice: ethersTypes.Signer
  let royaltiesAddress: string
  let erc20: ERC20Mintable
  let purchasableLicense: PurchasableLicenseManager
  let licenseAlice: PurchasableLicenseManager
  let squadNft: ERC721Squad

  const tokenData = {
    contentURI: 'example.com',
    metadataURI: 'example2.com',
    contentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('contentURI')),
    metadataHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('metadataURI'))
  }

  async function mintNFT (): Promise<void> {
    const nftAlice = squadNft.connect(alice)
    await nftAlice.mint(
      await alice.getAddress(),
      tokenData.contentURI,
      tokenData.metadataURI,
      tokenData.contentHash,
      tokenData.metadataHash
    )
  }

  beforeEach(async () => {
    const signers = await ethers.getSigners()
    owner = signers[0]
    alice = signers[1]
    royaltiesAddress = await signers[2].getAddress()

    const SquadNftFactory = new ERC721Squad__factory(owner)
    squadNft = await SquadNftFactory.deploy('Squad', 'sNFT')

    const ERC20MintableFactory = new ERC20Mintable__factory(owner)
    erc20 = await ERC20MintableFactory.deploy('Fake DAI', 'fDAI')

    const PurchasableLicenseManagerFactory = new PurchasableLicenseManager__factory(owner)
    purchasableLicense = await PurchasableLicenseManagerFactory.deploy(
      'Buy usage rights to an NFT for a set price.',
      squadNft.address,
      erc20.address,
      royaltiesAddress
    )
    licenseAlice = purchasableLicense.connect(alice)
  })

  describe('registerNFT', () => {
    it('stores new valid LicenseParams and emits event', async () => {
      await mintNFT()

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        ethers.utils.parseEther('10'),
        50,
        'type'
      ))
        .to.emit(purchasableLicense, 'NFTRegistered')

      const licenseParams = await purchasableLicense.registeredNFTs(squadNft.address, 0)

      // price
      assert.equal(Number(licenseParams[0]), Number(ethers.utils.parseEther('10')))

      // share percentage
      assert.equal(Number(licenseParams[1]), 50)

      // license token
      const licenseToken = erc20.attach(licenseParams[2])
      const balance = await licenseToken.balanceOf(await alice.getAddress())
      assert.equal(
        Number(balance),
        0
      )
    })

    it('replaces an old license for the same NFT', async () => {
      await mintNFT()

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        ethers.utils.parseEther('10'),
        50,
        'type'
      ))
        .to.emit(purchasableLicense, 'NFTRegistered')

      const firstLicenseParams = await purchasableLicense.registeredNFTs(squadNft.address, 0)

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        ethers.utils.parseEther('11'),
        51,
        'type'
      ))
        .to.emit(purchasableLicense, 'NFTRegistered')

      const licenseParams = await purchasableLicense.registeredNFTs(squadNft.address, 0)

      // price
      assert.equal(Number(licenseParams[0]), Number(ethers.utils.parseEther('11')))

      // share percentage
      assert.equal(Number(licenseParams[1]), 51)

      // license token
      assert.notEqual(licenseParams[2], firstLicenseParams[2])
    })

    it('fails if sharePercentage is greater than 100', async () => {
      await mintNFT()

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        10,
        101,
        'type'
      ))
        .to.be.revertedWith('sharePercentage greater than 100.')
    })

    it('fails if registrant does not own the NFT', async () => {
      await mintNFT()

      await expect(purchasableLicense.registerNFT(
        squadNft.address,
        0,
        await owner.getAddress(),
        10,
        50,
        'type'
      ))
        .to.be.revertedWith('Registrant does not own NFT.')
    })
  })

  it(
    'on createAndRegisterNFT, mints a new NFT to the msg.sender and calls registerNFT',
    async () => {
      await expect(purchasableLicense.createAndRegisterNFT(
        await alice.getAddress(),
        tokenData.contentURI,
        tokenData.metadataURI,
        tokenData.contentHash,
        tokenData.metadataHash,
        10,
        50,
        'type'
      ))
        .to.emit(purchasableLicense, 'NFTRegistered')

      const owner = await squadNft.ownerOf(0)
      const contentURI = await squadNft.contentURIs(0)
      const metadataURI = await squadNft.metadataURIs(0)
      assert.equal(owner, await alice.getAddress(), 'nft owner')
      assert.equal(contentURI, tokenData.contentURI, 'content URI')
      assert.equal(metadataURI, tokenData.metadataURI, 'metadata URI')

      // TODO add checks that the token was created correctly
    })

  describe('unregisterNFT', () => {
    it('deletes LicenseParams and emits event', async () => {
      await mintNFT()

      await licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        10,
        50,
        'type'
      )

      await expect(licenseAlice.unregisterNFT(
        squadNft.address,
        0
      ))
        .to.emit(purchasableLicense, 'NFTUnregistered')
        .withArgs(
          squadNft.address,
          ethers.BigNumber.from(0)
        )

      const licenseParams = await purchasableLicense.registeredNFTs(
        squadNft.address,
        0
      )
      assert.equal(licenseParams[2], '0x0000000000000000000000000000000000000000')
    })

    it('fails if NFT is not registered', async () => {
      await mintNFT()

      await expect(purchasableLicense.unregisterNFT(
        squadNft.address,
        0
      ))
        .to.be.revertedWith('NFT not registered.')
    })
  })

  it('on purchase, transfers tokens, mints license(s), and emits event', async () => {
    await mintNFT()

    await licenseAlice.registerNFT(
      squadNft.address,
      0,
      await alice.getAddress(),
      ethers.utils.parseEther('10'),
      50,
      'type'
    )

    const ownerAddress = await owner.getAddress()

    await erc20.mint(ownerAddress, ethers.utils.parseEther('100'))
    await erc20.approve(purchasableLicense.address, ethers.utils.parseEther('10'))

    const licenseTokenAddress = (await purchasableLicense.registeredNFTs(
      squadNft.address,
      0
    ))[2]

    await expect(purchasableLicense.purchase(
      squadNft.address,
      0,
      ownerAddress,
      1
    ))
      .to.emit(purchasableLicense, 'Purchase')
      .withArgs(
        squadNft.address,
        ethers.BigNumber.from(0),
        ownerAddress,
        1,
        ethers.utils.parseEther('10'),
        licenseTokenAddress
      )

    const licenseToken = erc20.attach(licenseTokenAddress)
    const balance = Number(ethers.utils.formatEther(await licenseToken.balanceOf(ownerAddress)))
    assert.equal(balance, 1)

    const royaltiesBalance = Number(ethers.utils.formatEther(await erc20.balanceOf(royaltiesAddress)))
    assert.equal(royaltiesBalance, 10)
  })

  describe('holdsLicense', () => {
    it('returns true if holder has 1+ ether of license token', async () => {
      await mintNFT()

      await licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        10,
        50,
        'type'
      )

      const ownerAddress = await owner.getAddress()

      await erc20.mint(ownerAddress, ethers.utils.parseEther('100'))
      await erc20.approve(purchasableLicense.address, ethers.utils.parseEther('10'))

      await purchasableLicense.purchase(
        squadNft.address,
        0,
        ownerAddress,
        1
      )

      assert.equal(
        await purchasableLicense.holdsLicense(
          squadNft.address,
          0,
          ownerAddress
        ),
        true
      )
    })

    it('on holdsLicense, returns false if holder has <1 ether of license token', async () => {
      await mintNFT()

      await licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        10,
        50,
        'type'
      )

      const ownerAddress = await owner.getAddress()

      await erc20.mint(ownerAddress, ethers.utils.parseEther('100'))
      await erc20.approve(purchasableLicense.address, ethers.utils.parseEther('10'))

      await purchasableLicense.purchase(
        squadNft.address,
        0,
        ownerAddress,
        1
      )

      const licenseTokenAddress = (await purchasableLicense.registeredNFTs(
        squadNft.address,
        0
      ))[2]
      const licenseToken = erc20.attach(licenseTokenAddress)
      const licenseOwner = licenseToken.connect(owner)
      await licenseOwner.transfer(
        await alice.getAddress(),
        1
      )

      assert.equal(
        await purchasableLicense.holdsLicense(
          squadNft.address,
          0,
          ownerAddress
        ),
        false
      )
    })
  })
})
