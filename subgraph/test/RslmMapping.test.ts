/**
 * a full local subgraph + contracts must be deployed before running tests (see README)
 *
 * - on NFTRegistered
 *    - license is added to content in subgraph
 *    - new license replaces the previous one
 *
 * - on NFTUnregistered
 *    - license is removed from content in subgraph
 *
 */

import { assert } from 'chai'
import {
  REV_SHARE_LM_ADDR,
  DEF_SHARE,
  DEF_TYPE,
  NFT,
  queryContent,
  queryRevShareLicenses,
  makeContentId,
  makeLicenseId,
  signer,
  registerRSL,
  unregisterRSL,
  mintAndRegisterRSL,
  delay
} from './utils'

async function checkNftRegistrationRSL (nft: NFT, share: number, type: string): Promise<void> {
  const content = await queryContent(nft)
  const licenses = await queryRevShareLicenses(nft, REV_SHARE_LM_ADDR)
  const license = licenses[0]

  const aliceAddress = signer.address
  assert.equal(content.id, makeContentId(nft), 'content id')
  assert.equal(content.nftAddress, nft.address, 'content nft address')
  assert.equal(content.nftId, nft.id, 'content nft id')
  assert.equal(content.type, type, 'content type')
  assert.equal(license.id, makeLicenseId(nft, REV_SHARE_LM_ADDR), 'license id')
  assert.equal(license.licenseManagerAddress, REV_SHARE_LM_ADDR, 'license manager address')
  assert.equal(license.registrant, aliceAddress.toLowerCase(), 'license registrant')
  assert.equal(license.minSharePercentage, share, 'license share percentage')
}

describe('RevShareLicenseManager mapping', function (this: any) {
  this.timeout(20000)

  it('should add a license on NFTRegistered event', async () => {
    const nft = await mintAndRegisterRSL()
    await checkNftRegistrationRSL(nft, DEF_SHARE, DEF_TYPE)
  })

  it('should replace existing license on NFTRegistered event', async () => {
    const nft = await mintAndRegisterRSL()
    await checkNftRegistrationRSL(nft, DEF_SHARE, DEF_TYPE)
    const newShare = 51
    const newType = 'text'
    await registerRSL(nft, newShare, newType)
    await delay()
    await checkNftRegistrationRSL(nft, newShare, newType)
  })

  it('should delete a license on NFTUnregistered event', async () => {
    const nft = await mintAndRegisterRSL()
    await checkNftRegistrationRSL(nft, DEF_SHARE, DEF_TYPE)
    await unregisterRSL(nft)
    const licenses = await queryRevShareLicenses(nft, REV_SHARE_LM_ADDR)
    assert.equal(licenses.length, 0)
  })
})
