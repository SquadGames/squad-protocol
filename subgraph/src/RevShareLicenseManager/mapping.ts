import { store, log } from "@graphprotocol/graph-ts"
import { NFTRegistered, NFTUnregistered } 
  from '../../generated/RevShareLicenseManager/RevShareLicenseManager'
import { RevShareLicense } from '../../generated/schema'
import { makeContentId, makeLicenseId, registrationContentAndLicenseId } from '../utils'

export function handleNFTRegisteredRevShare(event: NFTRegistered): void {
  let result = registrationContentAndLicenseId(
    event.address, 
    event.params.nftAddress,
    event.params.nftId,
    event.params.data
  )
  if (result.error != "none") {
    log.error(result.error, [])
    return
  }
  let licenseId = result.licenseId

  let revShareLicense = RevShareLicense.load(licenseId)
  if (revShareLicense == null) {
    revShareLicense = new RevShareLicense(licenseId)
    revShareLicense.licenseManagerAddress = event.address
    revShareLicense.content = result.contentId
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