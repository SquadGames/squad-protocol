import { 
  Address, 
  BigInt, 
  json, 
  ByteArray, 
  Bytes, 
  JSONValueKind, 
  TypedMap, 
  JSONValue 
} from "@graphprotocol/graph-ts"
import { Content } from '../generated/schema'

export function makeContentId(address: Address, id: BigInt): string {
  return address.toHex() + '-' + id.toHex()
}

export function makeLicenseId(contentId: string, address: Address): string {
  return contentId + '-' + address.toHex()
}

class ObjectResult { object: TypedMap<string, JSONValue>; error: string }

function getObject(data: string): ObjectResult {
  let result: ObjectResult
  result.error = "none"

  let jsonData = json.try_fromBytes(
    ByteArray.fromUTF8(data) as Bytes
  )
  if (jsonData.isError) {
    result.error = "Failed to parse JSON"
    return result
  }
  result.object = jsonData.value.toObject()
  return result
}

class TypeResult { type: string; error: string; }

function getType(object: TypedMap<string, JSONValue>): TypeResult {
  let result: TypeResult
  result.error = "none"

  let typeValue = object.get("type")
  if (typeValue.kind != JSONValueKind.STRING) { 
    result.error = "Missing valid 'type' field"
    return result
  }
  result.type = typeValue.toString()
  return result
}

class UnderlyingWorksResult { underlyingWorks: string[]; error: string }

function getUnderlyingWorks(object: TypedMap<string, JSONValue>): UnderlyingWorksResult {
  let result: UnderlyingWorksResult = { underlyingWorks: [], error: "none" }

  let underlyingWorksValue = object.get("underlyingWorks")
  if (underlyingWorksValue.kind != JSONValueKind.ARRAY) {
    result.error = "Missing valid 'underlyingWorks' field"
    return result
  }
  
  let underlyingWorksArray = underlyingWorksValue.toArray()
  for(let i = 0; i < underlyingWorksArray.length; i++) {
    if (underlyingWorksArray[i].kind != JSONValueKind.STRING) {
      result.error = "UnderlyingWorks array contains invalid value"
      return result
    }
    result.underlyingWorks.push(underlyingWorksArray[i].toString())
  }
  
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
  let result: PartialRegistrationResult
  result.error = "none"

  let contentId = makeContentId(nftAddress, nftId)
  let content = Content.load(contentId)
  if (content == null) {
    content = new Content(contentId)
    content.nftAddress = nftAddress
    content.nftId = nftId
  }

  /**
   * Left in for posterity: for some reason, setting result.contentId this way works here,
   * but result.contentId gets set to "none" somewhere before the return statement.
   * result.contentId = contentId
   */
  let objectRes = getObject(data)
  if (objectRes.error != "none") {
    result.error = objectRes.error
    return result
  }

  /**
   * More comments for posterity: I get 'wasm trap: out of bounds memory access' errors
   * when calling getUnderlyingWorks _after_ getType. Calling getUnderlyingWorks first works.
   */
  let underlyingWorksResult = getUnderlyingWorks(objectRes.object)
  if (underlyingWorksResult.error != "none") {
    result.error = underlyingWorksResult.error
    return result
  }
  if (underlyingWorksResult.underlyingWorks.length > 0) {
    content.underlyingWorks = underlyingWorksResult.underlyingWorks
  } else {
    content.underlyingWorks = null
  }

  let typeResult = getType(objectRes.object)
  if (typeResult.error != "none") {
    result.error = typeResult.error
    return result
  }
  content.type = typeResult.type

  content.save()

  result.contentId = content.id
  result.licenseId = makeLicenseId(contentId, address)
  return result
}