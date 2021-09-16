/**
 * Tests
 *  - on registerNFT, stores new valid LicenseParams and emits event
 *  - on registerNFT, fails if share basis points is greater than 100
 *  - on registerNFT, fails if registrant does not own the NFT
 *  - on createAndRegisterNFT, mints a new NFT to the msg.sender and calls registerNFT
 *  - on unregisterNFT, deletes LicenseParams and emits event
 *  - on unregisterNFT, fails if NFT is not registered
 *  - on unregisterNFT, fails if msg.sender does not own the NFT
 */

import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import { ethers as ethersTypes } from 'ethers'
import { RevShareLicenseManager } from '../typechain/RevShareLicenseManager'
import { RevShareLicenseManager__factory } from '../typechain/factories/RevShareLicenseManager__factory'
import { ERC721Squad } from '../typechain/ERC721Squad'
import { ERC721Squad__factory } from '../typechain/factories/ERC721Squad__factory'

describe('RevShareLicenseManager', () => {
  /**
     * Before each should:
     *  - prepare accounts (owner, alice)
     *  - deploy rev share license and mock media
     */

  let owner: ethersTypes.Signer
  let alice: ethersTypes.Signer
  let revShareLicense: RevShareLicenseManager
  let licenseAlice: RevShareLicenseManager
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

    const SquadNftFactory = new ERC721Squad__factory(owner)
    squadNft = await SquadNftFactory.deploy('Squad', 'sNFT')

    const RevShareLicenseManagerFactory = new RevShareLicenseManager__factory(owner)
    revShareLicense = await RevShareLicenseManagerFactory.deploy(
      'Commercial works derivative of works registered must share a percentage of revenue.',
      squadNft.address
    )

    licenseAlice = revShareLicense.connect(alice)
  })

  describe('registerNFT', () => {
    it('stores share percent and emits event', async () => {
      await mintNFT()

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        20,
        'type'
      ))
        .to.emit(revShareLicense, 'NFTRegistered')

      const registered = await revShareLicense.registeredNFTs(squadNft.address, 0)
      assert.isTrue(registered, 'registered')
      const shareBasisPoints = Number(await revShareLicense.minShareBasisPointsMap(squadNft.address, 0))
      assert.equal(shareBasisPoints, 20)
    })

    it('fails if minShareBasisPoints is greater than 10000', async () => {
      await mintNFT()

      await expect(licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        10001,
        'type'
      ))
        .to.be.revertedWith('minShareBasisPoints greater than 100.')
    })

    it('fails if registrant does not own the NFT', async () => {
      await mintNFT()

      await expect(revShareLicense.registerNFT(
        squadNft.address,
        0,
        await owner.getAddress(),
        20,
        'type'
      ))
        .to.be.revertedWith('Registrant does not own NFT.')
    })
  })

  it(
    'on createAndRegisterNFT, mints a new NFT to the msg.sender and calls registerNFT',
    async () => {
      await expect(revShareLicense.createAndRegisterNFT(
        await alice.getAddress(),
        tokenData.contentURI,
        tokenData.metadataURI,
        tokenData.contentHash,
        tokenData.metadataHash,
        50,
        'type'
      ))
        .to.emit(revShareLicense, 'NFTRegistered')
        .withArgs(
          squadNft.address,
          0,
          await alice.getAddress(),
          ethers.BigNumber.from(50),
          'type'
        )

      const owner = await squadNft.ownerOf(0)
      const contentURI = await squadNft.contentURIs(0)
      const metadataURI = await squadNft.metadataURIs(0)
      assert.equal(owner, await alice.getAddress(), 'nft owner')
      assert.equal(contentURI, tokenData.contentURI, 'content URI')
      assert.equal(metadataURI, tokenData.metadataURI, 'metadata URI')
    })

  describe('unregisterNFT', () => {
    it('deletes share percent and emits event', async () => {
      await mintNFT()

      await licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        20,
        'type'
      )

      // TODO should confirm registration here (and in other test)

      await expect(licenseAlice.unregisterNFT(
        squadNft.address,
        0
      ))
        .to.emit(revShareLicense, 'NFTUnregistered')

      const registered = await revShareLicense.registeredNFTs(squadNft.address, 0)
      assert.equal(registered, false)
      const minShareBasisPoints = Number(await revShareLicense.minShareBasisPointsMap(squadNft.address, 0))
      assert.equal(minShareBasisPoints, 0)
    })

    it('fails if NFT is not registered', async () => {
      await mintNFT()

      await expect(licenseAlice.unregisterNFT(
        squadNft.address,
        0
      ))
        .to.be.revertedWith('NFT not registered.')
    })

    it('fails if msg.sender does not own the NFT', async () => {
      await mintNFT()

      await licenseAlice.registerNFT(
        squadNft.address,
        0,
        await alice.getAddress(),
        20,
        'type'
      )

      await expect(revShareLicense.unregisterNFT(
        squadNft.address,
        0
      ))
        .to.be.revertedWith('Message sender does not own NFT.')
    })
  })
})
