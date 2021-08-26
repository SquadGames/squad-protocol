import { Address, BigInt, json, ByteArray, Bytes, JSONValueKind } from "@graphprotocol/graph-ts"
import { Content } from '../generated/schema'

export function makeContentId(address: Address, id: BigInt): string {
  return address.toHex() + '-' + id.toHex()
}

export function makeLicenseId(contentId: string, address: Address): string {
  return contentId + '-' + address.toHex()
}

class TypeResult { type: string; error: string; }

export function getType(data: string): TypeResult {
  let result: TypeResult = { type: "", error: "none"}
  let jsonData = json.try_fromBytes(
    ByteArray.fromUTF8(data) as Bytes
  )
  if (jsonData.isError) {
    result.error = "Failed to parse JSON"
    return result
  }
  let object = jsonData.value.toObject()
  let typeValue = object.get("type")
  if (typeValue.kind != JSONValueKind.STRING) { 
    result.error = "Missing valid 'type' field"
    return result
  }
  result.type = typeValue.toString()
  return result
}

class PartialRegistrationResult { 
  licenseId: string; 
  contentId: string; 
  error: string;
}

export function registrationContentAndLicenseId(
  address: Address,
  nftAddress: Address,
  nftId: BigInt,
  data: string
): PartialRegistrationResult {
  let result: PartialRegistrationResult = { licenseId: "", contentId: "", error: "none" }

  let contentId = makeContentId(nftAddress, nftId)
  let content = Content.load(contentId)
  if (content == null) {
    content = new Content(contentId)
    content.nftAddress = nftAddress
    content.nftId = nftId
  }
  result.contentId = contentId

  let typeResult = getType(data)
  if (typeResult.error != "none") {
    result.error = typeResult.error
    return result
  }
  content.type = typeResult.type
  content.save()

  result.licenseId = makeLicenseId(contentId, address)
  return result
}