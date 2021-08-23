import { store, Address, BigInt } from "@graphprotocol/graph-ts"
import { NFTRegistered, NFTUnregistered } 
  from '../../generated/RevShareLicenseManager/RevShareLicenseManager'
import { Content, RevShareLicense } from '../../generated/schema'
import { getType } from '../utils'

function makeContentId(address: Address, id: BigInt): string {
  return address.toHex() + '-' + id.toHex()
}

function makeLicenseId(contentId: string, address: Address): string {
  return contentId + '-' + address.toHex()
}

// should now also create or update an NFT with a type
export function handleNFTRegistered(event: NFTRegistered): void {
  let contentId = makeContentId(event.params.nftAddress, event.params.nftId)
  let content = Content.load(contentId)
  if (content == null) {
    content = new Content(contentId)
    content.nftAddress = event.params.nftAddress
    content.nftId = event.params.nftId
  }
  content.type = getType(event.params.data)
  content.save()

  let licenseId = makeLicenseId(contentId, event.address)
  let revShareLicense = RevShareLicense.load(licenseId)
  if (revShareLicense == null) {
    revShareLicense = new RevShareLicense(licenseId)
    revShareLicense.licenseManagerAddress = event.address
    revShareLicense.content = contentId
  }
  revShareLicense.registrant = event.transaction.from
  revShareLicense.minSharePercentage = event.params.minSharePercentage
  revShareLicense.save()
}

export function handleNFTUnregistered(event: NFTUnregistered): void {
  let contentId = makeContentId(event.params.nftAddress, event.params.nftId)
  let licenseId = makeLicenseId(contentId, event.address)
  store.remove('RevShareLicense', licenseId)
}