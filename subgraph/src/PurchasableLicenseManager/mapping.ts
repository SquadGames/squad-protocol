import { store, Address, BigInt } from "@graphprotocol/graph-ts"
import { NFTRegistered, NFTUnregistered, Purchase } 
  from '../../generated/PurchasableLicenseManager/PurchasableLicenseManager'
import { Content, PurchasableLicense, PurchaseEvent } from '../../generated/schema'
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
  let purchasableLicense = PurchasableLicense.load(licenseId)
  if (purchasableLicense == null) {
    purchasableLicense = new PurchasableLicense(licenseId)
    purchasableLicense.licenseManagerAddress = event.address
    purchasableLicense.content = contentId
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