/**
 * a full local subgraph + contracts must be deployed before running tests (see README)
 *
 * - on NFTRegistered
 *    - license is added to content in subgraph
 *    - new license replaces the previous one
 *
 * - on NFTUnregistered
 *    - License is removed from content in subgraph
 *
 * - on Purchase
 *    - Purchase event is added to subgraph
 *
 * http://127.0.0.1:8000/subgraphs/name/squadgames/squad-POC-subgraph/graphql
 */

import { ethers } from 'ethers'
import { assert } from 'chai'
import {
  DEF_PRICE,
  DEF_SHARE,
  DEF_TYPE,
  PURCHASABLE_LM_ADDR,
  NFT,
  queryContent,
  queryPurchasableLicenses,
  queryPurchases,
  getPurchasableLicense,
  makeContentId,
  makeLicenseId,
  signer,
  mintAndRegisterPL,
  registerPL,
  unregisterPL,
  mintDaiAndPurchase,
  delay
} from './utils'

async function checkNftRegistrationPL (
  nft: NFT,
  price: ethers.BigNumber,
  share: number,
  type: string,
  uses: any[]
): Promise<void> {
  const content = await queryContent(nft)
  const licenses = await queryPurchasableLicenses(nft, PURCHASABLE_LM_ADDR)
  const license = licenses[0]
  const licenseTokenAddr: string = (await getPurchasableLicense(nft)).licenseToken.toLowerCase()
  const aliceAddress = signer.address
  assert.equal(content.id, makeContentId(nft), 'content id')
  assert.equal(content.nftAddress, nft.address, 'content nft address')
  assert.equal(content.nftId, nft.id, 'content nft id')
  assert.equal(content.type, type, 'content type')
  assert.deepEqual(content.uses, uses, 'content uses')
  assert.equal(license.id, makeLicenseId(nft, PURCHASABLE_LM_ADDR), 'license id')
  assert.equal(license.licenseManagerAddress, PURCHASABLE_LM_ADDR, 'license manager address')
  assert.equal(license.licenseTokenAddress, licenseTokenAddr, 'license token address')
  assert.equal(license.registrant, aliceAddress.toLowerCase(), 'license registrant')
  assert.equal(license.price, price, 'license price')
  assert.equal(license.sharePercentage, share, 'license share percentage')
}

describe('PurchasableLicenseManager mapping', function (this: any) {
  this.timeout(20000)
  let nft1: NFT
  // matches the query for 'uses' in 'queryContent'
  let content1: { id: string }

  it('should add a license on NFTRegistered event', async () => {
    nft1 = await mintAndRegisterPL([])
    await checkNftRegistrationPL(nft1, DEF_PRICE, DEF_SHARE, DEF_TYPE, [])
  })

  it('should replace existing license on NFTRegistered event', async () => {
    content1 = await queryContent(nft1)
    const nft = await mintAndRegisterPL([content1.id])
    await checkNftRegistrationPL(nft, DEF_PRICE, DEF_SHARE, DEF_TYPE, [{ id: content1.id }])
    const newPrice = ethers.utils.parseEther('11')
    const newShare = 51
    const newType = 'text'
    const newUses = ['0x9876543']
    await registerPL(nft, newPrice, newShare, newType, newUses)
    await delay()
    await checkNftRegistrationPL(nft, newPrice, newShare, newType, [])
  })

  it('should delete a license on NFTUnregistered event', async () => {
    const nft = await mintAndRegisterPL([content1.id])
    await checkNftRegistrationPL(nft, DEF_PRICE, DEF_SHARE, DEF_TYPE, [{ id: content1.id }])
    await unregisterPL(nft)
    const licenses = await queryPurchasableLicenses(nft, PURCHASABLE_LM_ADDR)
    assert.equal(licenses.length, 0)
  })

  it('should record a Purchase', async () => {
    const nft = await mintAndRegisterPL([content1.id])
    await checkNftRegistrationPL(nft, DEF_PRICE, DEF_SHARE, DEF_TYPE, [{ id: content1.id }])
    const blockNumber = await mintDaiAndPurchase(nft, DEF_PRICE)
    const purchase = (await queryPurchases(nft, PURCHASABLE_LM_ADDR))[0]
    const licenseTokenAddr: string = (
      await getPurchasableLicense(nft)
    ).licenseToken.toLowerCase()
    const aliceAddress = signer.address
    assert.equal(purchase.licenseTokenAddress, licenseTokenAddr, 'license token address')
    assert.equal(purchase.licensesBought, '1', 'licenses bought')
    assert.equal(purchase.pricePaid, DEF_PRICE, 'price paid')
    assert.equal(purchase.purchaser, aliceAddress.toLowerCase(), 'purchaser')
    assert.equal(purchase.blockNumber, blockNumber, 'block number')
  })
})
