import { store, log } from "@graphprotocol/graph-ts"
import { NFTRegistered, NFTUnregistered, Purchase } 
  from '../../generated/PurchasableLicenseManager/PurchasableLicenseManager'
import { PurchasableLicense, PurchaseEvent } from '../../generated/schema'
import { makeContentId, makeLicenseId, registrationContentAndLicenseId } from '../utils'

export function handleNFTRegisteredPurchasable(event: NFTRegistered): void {
  let result = registrationContentAndLicenseId(
    event.address, 
    event.params.nftAddress,
    event.params.nftId,
    event.params.data
  )
  if (result.error != "none") {
    log.warning(result.error, [])
    return
  }
  let licenseId = result.licenseId

  let purchasableLicense = PurchasableLicense.load(licenseId)
  if (purchasableLicense == null) {
    purchasableLicense = new PurchasableLicense(licenseId)
    purchasableLicense.licenseManagerAddress = event.address
    purchasableLicense.content = result.contentId
  }
  purchasableLicense.registrant = event.transaction.from
  purchasableLicense.price = event.params.price
  purchasableLicense.sharePercentage = event.params.sharePercentage
  purchasableLicense.licenseTokenAddress = event.params.licenseTokenAddress
  purchasableLicense.save()
}

export function handleNFTUnregistered(event: NFTUnregistered): void {
  let contentId = makeContentId(event.params.nftAddress, event.params.nftId)
  let licenseId = makeLicenseId(contentId, event.address)
  store.remove('PurchasableLicense', licenseId)
}

export function handlePurchase(event: Purchase): void {
  let purchaseEvent = new PurchaseEvent(event.transaction.hash.toHex())
  let contentId = makeContentId(event.params.nftAddress, event.params.nftId)
  purchaseEvent.license = makeLicenseId(contentId, event.address)
  purchaseEvent.purchaser = event.params.purchaser
  purchaseEvent.licensesBought = event.params.licensesBought
  purchaseEvent.pricePaid = event.params.price
  purchaseEvent.licenseTokenAddress = event.params.licenseTokenAddress
  purchaseEvent.blockNumber = event.block.number
  purchaseEvent.save()
}